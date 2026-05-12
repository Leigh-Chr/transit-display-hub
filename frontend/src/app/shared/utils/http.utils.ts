/**
 * Extract a user-facing error message from an HTTP error response.
 * Falls back to the provided default if the error doesn't carry a
 * server-side message.
 *
 * The Spring Boot backend returns errors in the shape
 * `{ error: { message: string } }` via GlobalExceptionHandler.
 */
export function httpErrorMessage(err: unknown, fallback: string): string {
  // The cast assumes non-nullish but the spec deliberately passes null
  // / undefined / strings to prove the helper degrades gracefully; the
  // optional chain is what makes that contract work, so the lint rule
  // is silenced here on purpose.
  const httpErr = err as { error?: { message?: string } };
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
  return httpErr?.error?.message ?? fallback;
}
