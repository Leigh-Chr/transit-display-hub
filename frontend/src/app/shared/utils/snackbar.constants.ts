/** Standardized snackbar display durations (ms).
 *  Centralized so the whole app keeps a coherent feedback rhythm and a
 *  designer can tune all toasts at once. */
export const SNACKBAR_DURATIONS = {
  /** Confirms a successful CRUD action — short, non-intrusive. */
  success: 3000,
  /** Conveys a recoverable error — long enough to read the cause. */
  error: 5000,
  /** Soft warning, less urgent than an error. */
  warning: 4000,
  /** Neutral informational message — same cadence as a warning. */
  info: 4000,
  /** Errors that offer a "Retry" action — must stay long enough to click. */
  retryable: 8000,
} as const;
