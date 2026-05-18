package com.transit.hub.api.advice;

import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ImportAlreadyRunningException;
import com.transit.hub.application.exception.ValidationException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.context.MessageSource;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.MissingServletRequestParameterException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

@RestControllerAdvice
@RequiredArgsConstructor
@Slf4j
public class GlobalExceptionHandler {

    private final MessageSource messageSource;

    /** Resolve a key against the active locale (from the Accept-Language
     *  header by default). Falls back to the EN default in messages.properties. */
    private String t(String key, Object... args) {
        return messageSource.getMessage(key, args, LocaleContextHolder.getLocale());
    }

    public record ApiError(
            Instant timestamp,
            int status,
            String error,
            @Nullable String message,
            @Nullable List<FieldErrorInfo> errors,
            String path
    ) {
        public record FieldErrorInfo(String field, @Nullable String message) {}
    }

    @ExceptionHandler(EntityNotFoundException.class)
    public ResponseEntity<ApiError> handleNotFound(EntityNotFoundException ex, WebRequest request) {
        log.warn("Entity not found: {}", ex.getMessage());
        String message = ex.getMessageKey() != null
                ? messageSource.getMessage(ex.getMessageKey(), ex.getMessageArgs(),
                        ex.getMessage(), LocaleContextHolder.getLocale())
                : ex.getMessage();
        return buildErrorResponse(HttpStatus.NOT_FOUND, message, null, request);
    }

    @ExceptionHandler(ValidationException.class)
    public ResponseEntity<ApiError> handleValidation(ValidationException ex, WebRequest request) {
        log.warn("Validation error: {}", ex.getMessage());
        String message = ex.getMessageKey() != null
                ? messageSource.getMessage(ex.getMessageKey(), ex.getMessageArgs(),
                        ex.getMessage(), LocaleContextHolder.getLocale())
                : ex.getMessage();
        return buildErrorResponse(HttpStatus.BAD_REQUEST, message, null, request);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiError> handleIllegalArgument(IllegalArgumentException ex, WebRequest request) {
        // The full reason stays in the server log (useful for triage) but the
        // client gets a generic, localised message — IllegalArgumentException
        // is thrown from low-level utilities (Pageables, parsers, internal
        // assertions) whose raw messages are not safe to surface and would
        // never be translated.
        log.warn("Illegal argument: {}", ex.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, t("error.request.invalid"), null, request);
    }

    @ExceptionHandler(MissingServletRequestParameterException.class)
    public ResponseEntity<ApiError> handleMissingParam(MissingServletRequestParameterException ex,
                                                       WebRequest request) {
        log.warn("Missing required request parameter: {}", ex.getParameterName());
        return buildErrorResponse(HttpStatus.BAD_REQUEST,
                t("error.request.missingParam", ex.getParameterName()), null, request);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<ApiError> handleTypeMismatch(MethodArgumentTypeMismatchException ex,
                                                       WebRequest request) {
        log.warn("Type mismatch on request parameter '{}': {}", ex.getName(), ex.getMessage());
        return buildErrorResponse(HttpStatus.BAD_REQUEST,
                t("error.request.typeMismatch", ex.getName()), null, request);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<ApiError> handleNoResource(NoResourceFoundException ex, WebRequest request) {
        // Spring routes unknown URLs through the static-resource handler,
        // which raises NoResourceFoundException. The catch-all below
        // would render 500 for those — return 404 instead so a typo'd
        // path looks like a real not-found rather than a server bug.
        return buildErrorResponse(HttpStatus.NOT_FOUND, t("error.entity.notFound"), null, request);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiError> handleValidationErrors(MethodArgumentNotValidException ex, WebRequest request) {
        List<ApiError.FieldErrorInfo> fieldErrors = ex.getBindingResult().getAllErrors().stream()
                .map(error -> {
                    String fieldName = error instanceof FieldError fe ? fe.getField() : error.getObjectName();
                    return new ApiError.FieldErrorInfo(fieldName, error.getDefaultMessage());
                })
                .toList();

        log.warn("Validation failed: {} errors", fieldErrors.size());
        return buildErrorResponse(HttpStatus.BAD_REQUEST, t("error.validation.failed"), fieldErrors, request);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<ApiError> handleDataIntegrity(DataIntegrityViolationException ex, WebRequest request) {
        log.warn("Data integrity violation: {}", ex.getMessage());
        String messageKey = "error.data.conflict";
        Throwable cause = ex.getMostSpecificCause();
        String causeMessage = cause.getMessage();
        if (causeMessage != null) {
            String lower = causeMessage.toLowerCase(Locale.ROOT);
            if (lower.contains("foreign key") || lower.contains("fk_") || lower.contains("references")) {
                messageKey = "error.data.foreignKey";
            } else if (lower.contains("not null") || lower.contains("not-null")) {
                messageKey = "error.data.notNull";
            }
        }
        return buildErrorResponse(HttpStatus.CONFLICT, t(messageKey), null, request);
    }

    @ExceptionHandler(OptimisticLockingFailureException.class)
    public ResponseEntity<ApiError> handleOptimisticLock(OptimisticLockingFailureException ex, WebRequest request) {
        log.warn("Optimistic lock conflict: {}", ex.getMessage());
        return buildErrorResponse(HttpStatus.CONFLICT, t("error.data.optimisticLock"), null, request);
    }

    @ExceptionHandler(ImportAlreadyRunningException.class)
    public ResponseEntity<ApiError> handleImportAlreadyRunning(ImportAlreadyRunningException ex, WebRequest request) {
        log.warn("GTFS import already running, refused trigger: {}", ex.getMessageKey());
        return buildErrorResponse(HttpStatus.CONFLICT, t(ex.getMessageKey()), null, request);
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<ApiError> handleAccessDenied(AccessDeniedException ex, WebRequest request) {
        log.warn("Access denied: {}", ex.getMessage());
        return buildErrorResponse(HttpStatus.FORBIDDEN, t("error.security.accessDenied"), null, request);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<ApiError> handleBadCredentials(BadCredentialsException ex, WebRequest request) {
        log.warn("Authentication failed: {}", ex.getMessage());
        return buildErrorResponse(HttpStatus.UNAUTHORIZED, t("error.security.badCredentials"), null, request);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiError> handleGenericException(Exception ex, WebRequest request) {
        log.error("Unexpected error", ex);
        return buildErrorResponse(HttpStatus.INTERNAL_SERVER_ERROR, t("error.generic"), null, request);
    }

    private ResponseEntity<ApiError> buildErrorResponse(
            HttpStatus status,
            @Nullable String message,
            @Nullable List<ApiError.FieldErrorInfo> fieldErrors,
            WebRequest request
    ) {
        String path = request.getDescription(false).replace("uri=", "");

        ApiError error = new ApiError(
                Instant.now(),
                status.value(),
                status.getReasonPhrase(),
                message,
                fieldErrors,
                path
        );

        return ResponseEntity.status(status).body(error);
    }
}
