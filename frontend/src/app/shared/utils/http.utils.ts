/**
 * Extract a user-facing error message from an HTTP error response.
 * Falls back to the provided default if the error doesn't carry a
 * server-side message.
 *
 * The Spring Boot backend returns errors in the shape
 * `{ error: { message: string } }` via GlobalExceptionHandler.
 */
export function httpErrorMessage(err: unknown, fallback: string): string {
  const httpErr = err as { error?: { message?: string } };
  return httpErr?.error?.message ?? fallback;
}
