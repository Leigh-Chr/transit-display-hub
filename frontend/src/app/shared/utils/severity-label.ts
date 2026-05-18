/**
 * Maps a GTFS-RT / broadcast-message severity to its localised label.
 *
 * The two admin pages (Messages and Realtime) both ship their own copy
 * of the same switch with a different Transloco namespace; this util
 * accepts the namespace as an argument so the call stays a one-liner
 * while the implementation lives in one place.
 *
 * @param severity the raw severity (CRITICAL/WARNING/INFO) or anything
 *                 outside that set — non-matching values fall through to
 *                 the value itself (empty string when null/undefined),
 *                 keeping behaviour identical to the previous in-place
 *                 implementations.
 * @param namespace Transloco key prefix the page uses to scope its
 *                  copies (e.g. `admin.messages` or `admin.realtime`).
 *                  The util appends `.severityCritical` / `.severityWarning`
 *                  / `.severityInfo`.
 * @param t the Transloco translate fn provided by `*transloco="let t"`.
 */
export function severityLabel(
  severity: string | null | undefined,
  namespace: string,
  t: (key: string) => string,
): string {
  switch (severity) {
    case 'CRITICAL':
      return t(`${namespace}.severityCritical`);
    case 'WARNING':
      return t(`${namespace}.severityWarning`);
    case 'INFO':
      return t(`${namespace}.severityInfo`);
    default:
      return severity ?? '';
  }
}
