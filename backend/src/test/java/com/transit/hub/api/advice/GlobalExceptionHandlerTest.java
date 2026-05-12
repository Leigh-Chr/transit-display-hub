package com.transit.hub.api.advice;

import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.i18n.LocaleContextHolder;
import org.springframework.context.support.ResourceBundleMessageSource;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.BindingResult;
import org.springframework.validation.FieldError;
import org.springframework.validation.ObjectError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.context.request.WebRequest;

import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("GlobalExceptionHandler")
class GlobalExceptionHandlerTest {

    private GlobalExceptionHandler exceptionHandler;

    @Mock
    private WebRequest webRequest;

    @Mock
    private BindingResult bindingResult;

    @BeforeEach
    void setUp() {
        // Real ResourceBundleMessageSource so the assertions in this suite
        // can keep checking the rendered (EN) text instead of guessing what
        // a stub would return per locale. Pin the thread locale to ENGLISH
        // so the suite is deterministic on hosts whose default is fr_FR.
        LocaleContextHolder.setLocale(Locale.ENGLISH);
        ResourceBundleMessageSource messageSource = new ResourceBundleMessageSource();
        messageSource.setBasename("messages");
        messageSource.setDefaultEncoding("UTF-8");
        // Without this, ResourceBundle falls back to the JVM default
        // locale (fr_FR on this host) when the requested locale has no
        // bundle of its own, dragging French strings into the EN suite.
        messageSource.setFallbackToSystemLocale(false);
        exceptionHandler = new GlobalExceptionHandler(messageSource);

        when(webRequest.getDescription(false)).thenReturn("uri=/api/test");
    }

    @Nested
    @DisplayName("handleNotFound — entity type variations")
    class HandleNotFound {

        @ParameterizedTest(name = "[{index}] {0} id={1}")
        @CsvSource({
            "Line,   1,   Line",
            "Stop,  42,   Stop",
            "Device, 99,  Device",
        })
        @DisplayName("returns 404 with the correct entity type and id in the message")
        void returnsCorrectMessageForEntityType(String entity, Long id, String expectedEntity) {
            EntityNotFoundException exception = new EntityNotFoundException(entity, id);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleNotFound(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(404);
            assertThat(response.getBody().error()).isEqualTo("Not Found");
            assertThat(response.getBody().message()).contains(expectedEntity);
            assertThat(response.getBody().message()).contains(id.toString());
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }
    }

    @Nested
    @DisplayName("handleValidation — message pass-through")
    class HandleValidation {

        @ParameterizedTest(name = "[{index}] {0}")
        @CsvSource({
            "blank-code,         Invalid line code format",
            "future-only,        Schedule time must be in the future",
            "overlap,            Time ranges must not overlap",
        })
        @DisplayName("returns 400 and echoes the validation message verbatim")
        void returnsBadRequestWithMessage(String description, String message) {
            ValidationException exception = new ValidationException(message);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleValidation(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(400);
            assertThat(response.getBody().error()).isEqualTo("Bad Request");
            assertThat(response.getBody().message()).isEqualTo(message);
            assertThat(response.getBody().errors()).isNull();
        }
    }

    @Nested
    @DisplayName("handleIllegalArgument — message pass-through")
    class HandleIllegalArgument {

        @ParameterizedTest(name = "[{index}] {0}")
        @CsvSource({
            "date-range,    Invalid date range",
            "time-order,    Start time must be before end time",
            "negative,      Value must be positive",
        })
        @DisplayName("returns 400 and echoes the IllegalArgumentException message")
        void returnsBadRequestWithMessage(String description, String message) {
            IllegalArgumentException exception = new IllegalArgumentException(message);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleIllegalArgument(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(400);
            assertThat(response.getBody().message()).isEqualTo(message);
        }
    }

    @Nested
    @DisplayName("handleValidationErrors")
    class HandleValidationErrors {

        @Test
        @DisplayName("returns 400 with field error details")
        void returnsBadRequestWithFieldErrors() {
            FieldError fieldError1 = new FieldError("lineRequest", "code", "must not be blank");
            FieldError fieldError2 = new FieldError("lineRequest", "name", "must not be null");
            List<ObjectError> errors = List.of(fieldError1, fieldError2);

            MethodArgumentNotValidException exception = new MethodArgumentNotValidException(null, bindingResult);
            when(bindingResult.getAllErrors()).thenReturn(errors);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleValidationErrors(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Validation failed");
            assertThat(response.getBody().errors()).hasSize(2);

            GlobalExceptionHandler.ApiError.FieldErrorInfo error1 = response.getBody().errors().get(0);
            assertThat(error1.field()).isEqualTo("code");
            assertThat(error1.message()).isEqualTo("must not be blank");

            GlobalExceptionHandler.ApiError.FieldErrorInfo error2 = response.getBody().errors().get(1);
            assertThat(error2.field()).isEqualTo("name");
            assertThat(error2.message()).isEqualTo("must not be null");
        }

        @Test
        @DisplayName("handles ObjectError without field name")
        void handlesObjectErrorWithoutFieldName() {
            ObjectError objectError = new ObjectError("lineRequest", "object validation failed");
            List<ObjectError> errors = List.of(objectError);

            MethodArgumentNotValidException exception = new MethodArgumentNotValidException(null, bindingResult);
            when(bindingResult.getAllErrors()).thenReturn(errors);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleValidationErrors(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().errors()).hasSize(1);
            assertThat(response.getBody().errors().get(0).field()).isEqualTo("lineRequest");
            assertThat(response.getBody().errors().get(0).message()).isEqualTo("object validation failed");
        }

        @Test
        @DisplayName("handles empty error list")
        void handlesEmptyErrorList() {
            MethodArgumentNotValidException exception = new MethodArgumentNotValidException(null, bindingResult);
            when(bindingResult.getAllErrors()).thenReturn(List.of());

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleValidationErrors(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Validation failed");
            assertThat(response.getBody().errors()).isEmpty();
        }
    }

    @Nested
    @DisplayName("handleDataIntegrity — cause-based message selection")
    class HandleDataIntegrity {

        @ParameterizedTest(name = "[{index}] {0}")
        @CsvSource({
            "foreign-key, 'Referential integrity constraint violation: FK_STOP_LINE references', Cannot complete operation: this record is referenced by other data",
            "not-null,    'NULL not allowed for column \"NAME\"; SQL [NOT NULL check constraint',  A required field is missing",
            "unique,      'Unique index or primary key violation',                                 Data conflict: a record with this value already exists",
            "generic,     'Some generic DB error',                                                 Data conflict: a record with this value already exists",
        })
        @DisplayName("maps the root-cause message to the correct user-facing response")
        void mapsCorrectly(String description, String causeMessage, String expectedMessage) {
            var cause = new RuntimeException(causeMessage);
            DataIntegrityViolationException exception =
                    new DataIntegrityViolationException("db error", cause);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleDataIntegrity(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(409);
            assertThat(response.getBody().message()).isEqualTo(expectedMessage);
        }

        @Test
        @DisplayName("returns conflict even when exception has no nested cause")
        void noCause() {
            DataIntegrityViolationException exception =
                    new DataIntegrityViolationException("Unique constraint violation");

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleDataIntegrity(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(409);
            assertThat(response.getBody().message())
                    .isEqualTo("Data conflict: a record with this value already exists");
        }
    }

    @Nested
    @DisplayName("handleAccessDenied")
    class HandleAccessDenied {

        @ParameterizedTest(name = "[{index}] message=''{0}''")
        @CsvSource({
            "Access is denied",
            "Specific internal reason",
            "You shall not pass",
        })
        @DisplayName("always returns 403 with generic message regardless of exception detail")
        void alwaysReturnsGenericMessage(String exceptionMessage) {
            AccessDeniedException exception = new AccessDeniedException(exceptionMessage);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleAccessDenied(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(403);
            assertThat(response.getBody().message()).isEqualTo("Access denied: insufficient permissions");
        }
    }

    @Nested
    @DisplayName("handleBadCredentials")
    class HandleBadCredentials {

        @ParameterizedTest(name = "[{index}] message=''{0}''")
        @CsvSource({
            "Bad credentials",
            "User not found",
            "Account locked",
        })
        @DisplayName("always returns 401 with generic message regardless of exception detail")
        void alwaysReturnsGenericMessage(String exceptionMessage) {
            BadCredentialsException exception = new BadCredentialsException(exceptionMessage);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleBadCredentials(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(401);
            assertThat(response.getBody().message()).isEqualTo("Invalid credentials");
        }
    }

    @Nested
    @DisplayName("handleGenericException")
    class HandleGenericException {

        @ParameterizedTest(name = "[{index}] {0}")
        @CsvSource({
            "runtime,     Unexpected failure",
            "npe,         Null reference",
            "sensitive,   Sensitive internal error with database credentials",
        })
        @DisplayName("always returns 500 with opaque message, hiding internal details")
        void alwaysReturnsOpaqueMessage(String description, String exceptionMessage) {
            RuntimeException exception = new RuntimeException(exceptionMessage);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleGenericException(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(500);
            assertThat(response.getBody().message()).isEqualTo("An unexpected error occurred");
            assertThat(response.getBody().message()).doesNotContain(exceptionMessage);
        }
    }

    @Nested
    @DisplayName("ApiError Response Structure")
    class ApiErrorStructure {

        @Test
        @DisplayName("includes all required fields in response")
        void includesAllRequiredFields() {
            EntityNotFoundException exception = new EntityNotFoundException("Device", 123L);

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleNotFound(exception, webRequest);

            GlobalExceptionHandler.ApiError apiError = response.getBody();
            assertThat(apiError).isNotNull();
            assertThat(apiError.timestamp()).isNotNull();
            assertThat(apiError.status()).isPositive();
            assertThat(apiError.error()).isNotBlank();
            assertThat(apiError.message()).isNotBlank();
            assertThat(apiError.path()).isNotBlank();
        }

        @Test
        @DisplayName("path is extracted correctly from WebRequest description")
        void extractsPathCorrectly() {
            when(webRequest.getDescription(false)).thenReturn("uri=/api/lines/123");
            ValidationException exception = new ValidationException("Test error");

            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleValidation(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/lines/123");
        }

        @Test
        @DisplayName("error field matches HTTP status reason phrase")
        void errorFieldMatchesStatusReasonPhrase() {
            ValidationException exception = new ValidationException("Test");
            ResponseEntity<GlobalExceptionHandler.ApiError> response =
                    exceptionHandler.handleValidation(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().error()).isEqualTo(HttpStatus.BAD_REQUEST.getReasonPhrase());
            assertThat(response.getBody().status()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        }
    }
}
