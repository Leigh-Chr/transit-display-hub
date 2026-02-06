package com.transit.hub.api.advice;

import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
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

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("GlobalExceptionHandler")
class GlobalExceptionHandlerTest {

    @InjectMocks
    private GlobalExceptionHandler exceptionHandler;

    @Mock
    private WebRequest webRequest;

    @Mock
    private BindingResult bindingResult;

    @BeforeEach
    void setUp() {
        when(webRequest.getDescription(false)).thenReturn("uri=/api/test");
    }

    @Nested
    @DisplayName("handleNotFound")
    class HandleNotFound {

        @Test
        @DisplayName("returns 404 with entity not found message")
        void returnsNotFoundStatus() {
            EntityNotFoundException exception = new EntityNotFoundException("Line", 1L);

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleNotFound(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.NOT_FOUND);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(404);
            assertThat(response.getBody().error()).isEqualTo("Not Found");
            assertThat(response.getBody().message()).contains("Line");
            assertThat(response.getBody().message()).contains("1");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }

        @Test
        @DisplayName("returns correct message for different entity types")
        void handlesMultipleEntityTypes() {
            EntityNotFoundException stopException = new EntityNotFoundException("Stop", 42L);

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleNotFound(stopException, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).contains("Stop");
            assertThat(response.getBody().message()).contains("42");
        }
    }

    @Nested
    @DisplayName("handleValidation")
    class HandleValidation {

        @Test
        @DisplayName("returns 400 with validation error message")
        void returnsBadRequestStatus() {
            ValidationException exception = new ValidationException("Invalid line code format");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleValidation(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(400);
            assertThat(response.getBody().error()).isEqualTo("Bad Request");
            assertThat(response.getBody().message()).isEqualTo("Invalid line code format");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }

        @Test
        @DisplayName("handles different validation messages")
        void handlesMultipleValidationMessages() {
            ValidationException exception = new ValidationException("Schedule time must be in the future");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleValidation(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Schedule time must be in the future");
        }
    }

    @Nested
    @DisplayName("handleIllegalArgument")
    class HandleIllegalArgument {

        @Test
        @DisplayName("returns 400 with illegal argument message")
        void returnsBadRequestStatus() {
            IllegalArgumentException exception = new IllegalArgumentException("Invalid date range");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleIllegalArgument(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(400);
            assertThat(response.getBody().error()).isEqualTo("Bad Request");
            assertThat(response.getBody().message()).isEqualTo("Invalid date range");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }

        @Test
        @DisplayName("handles different illegal argument messages")
        void handlesMultipleIllegalArgumentMessages() {
            IllegalArgumentException exception = new IllegalArgumentException("Start time must be before end time");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleIllegalArgument(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Start time must be before end time");
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

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleValidationErrors(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.BAD_REQUEST);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(400);
            assertThat(response.getBody().error()).isEqualTo("Bad Request");
            assertThat(response.getBody().message()).isEqualTo("Validation failed");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNotNull();
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

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleValidationErrors(exception, webRequest);

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

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleValidationErrors(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Validation failed");
            assertThat(response.getBody().errors()).isEmpty();
        }
    }

    @Nested
    @DisplayName("handleDataIntegrity")
    class HandleDataIntegrity {

        @Test
        @DisplayName("returns 409 with conflict message")
        void returnsConflictStatus() {
            DataIntegrityViolationException exception = new DataIntegrityViolationException("Unique constraint violation");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleDataIntegrity(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(409);
            assertThat(response.getBody().error()).isEqualTo("Conflict");
            assertThat(response.getBody().message()).isEqualTo("Data conflict: a record with this value already exists");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }

        @Test
        @DisplayName("returns foreign key message when cause mentions foreign key")
        void returnsForeignKeyMessage() {
            var cause = new RuntimeException("Referential integrity constraint violation: FK_STOP_LINE references");
            DataIntegrityViolationException exception = new DataIntegrityViolationException("could not execute", cause);

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleDataIntegrity(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Cannot complete operation: this record is referenced by other data");
        }

        @Test
        @DisplayName("returns not-null message when cause mentions not null")
        void returnsNotNullMessage() {
            var cause = new RuntimeException("NULL not allowed for column \"NAME\"; SQL [NOT NULL check constraint");
            DataIntegrityViolationException exception = new DataIntegrityViolationException("not null", cause);

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleDataIntegrity(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("A required field is missing");
        }

        @Test
        @DisplayName("returns unique constraint message for other violations")
        void returnsUniqueConstraintMessage() {
            var cause = new RuntimeException("Unique index or primary key violation");
            DataIntegrityViolationException exception = new DataIntegrityViolationException("unique", cause);

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleDataIntegrity(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Data conflict: a record with this value already exists");
        }
    }

    @Nested
    @DisplayName("handleAccessDenied")
    class HandleAccessDenied {

        @Test
        @DisplayName("returns 403 with access denied message")
        void returnsForbiddenStatus() {
            AccessDeniedException exception = new AccessDeniedException("Access is denied");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleAccessDenied(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.FORBIDDEN);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(403);
            assertThat(response.getBody().error()).isEqualTo("Forbidden");
            assertThat(response.getBody().message()).isEqualTo("Access denied: insufficient permissions");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }

        @Test
        @DisplayName("returns generic message regardless of exception message")
        void returnsGenericMessage() {
            AccessDeniedException exception = new AccessDeniedException("Specific internal reason");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleAccessDenied(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Access denied: insufficient permissions");
        }
    }

    @Nested
    @DisplayName("handleBadCredentials")
    class HandleBadCredentials {

        @Test
        @DisplayName("returns 401 with invalid credentials message")
        void returnsUnauthorizedStatus() {
            BadCredentialsException exception = new BadCredentialsException("Bad credentials");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleBadCredentials(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(401);
            assertThat(response.getBody().error()).isEqualTo("Unauthorized");
            assertThat(response.getBody().message()).isEqualTo("Invalid credentials");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }

        @Test
        @DisplayName("returns generic message regardless of exception message")
        void returnsGenericMessage() {
            BadCredentialsException exception = new BadCredentialsException("User not found");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleBadCredentials(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("Invalid credentials");
        }
    }

    @Nested
    @DisplayName("handleGenericException")
    class HandleGenericException {

        @Test
        @DisplayName("returns 500 with generic error message")
        void returnsInternalServerError() {
            RuntimeException exception = new RuntimeException("Unexpected failure");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleGenericException(exception, webRequest);

            assertThat(response.getStatusCode()).isEqualTo(HttpStatus.INTERNAL_SERVER_ERROR);
            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(500);
            assertThat(response.getBody().error()).isEqualTo("Internal Server Error");
            assertThat(response.getBody().message()).isEqualTo("An unexpected error occurred");
            assertThat(response.getBody().timestamp()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/test");
            assertThat(response.getBody().errors()).isNull();
        }

        @Test
        @DisplayName("handles NullPointerException")
        void handlesNullPointerException() {
            NullPointerException exception = new NullPointerException("Null reference");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleGenericException(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().status()).isEqualTo(500);
            assertThat(response.getBody().message()).isEqualTo("An unexpected error occurred");
        }

        @Test
        @DisplayName("hides exception details from client")
        void hidesExceptionDetails() {
            RuntimeException exception = new RuntimeException("Sensitive internal error with database credentials");

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleGenericException(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().message()).isEqualTo("An unexpected error occurred");
            assertThat(response.getBody().message()).doesNotContain("Sensitive");
            assertThat(response.getBody().message()).doesNotContain("database");
        }
    }

    @Nested
    @DisplayName("ApiError Response Structure")
    class ApiErrorStructure {

        @Test
        @DisplayName("includes all required fields in response")
        void includesAllRequiredFields() {
            EntityNotFoundException exception = new EntityNotFoundException("Device", 123L);

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleNotFound(exception, webRequest);

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

            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleValidation(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().path()).isEqualTo("/api/lines/123");
        }

        @Test
        @DisplayName("error field matches HTTP status reason phrase")
        void errorFieldMatchesStatusReasonPhrase() {
            ValidationException exception = new ValidationException("Test");
            ResponseEntity<GlobalExceptionHandler.ApiError> response = exceptionHandler.handleValidation(exception, webRequest);

            assertThat(response.getBody()).isNotNull();
            assertThat(response.getBody().error()).isEqualTo(HttpStatus.BAD_REQUEST.getReasonPhrase());
            assertThat(response.getBody().status()).isEqualTo(HttpStatus.BAD_REQUEST.value());
        }
    }
}
