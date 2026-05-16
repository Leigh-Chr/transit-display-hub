import { formatLocaleDate } from './locale-date.utils';

/**
 * Time helpers shared by the kiosk and hub display boards. The two
 * components previously carried mirrored copies of these four
 * functions; centralising them keeps midnight wrap-around (-360 min
 * threshold) consistent and lets unit tests cover the boundary in
 * one place.
 *
 * Every function that needs "now" accepts it as an explicit
 * parameter so callers stay clock-aware without leaking
 * {@code Date.now()} reads into pure utilities.
 */

/** "HH:MM" clock time formatted in the supplied locale. */
export function formatClockTime(date: Date, locale: string): string {
  return formatLocaleDate(date, locale, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** "Mon, Jan 1, 2026" style date formatted in the supplied locale. */
export function formatClockDate(date: Date, locale: string): string {
  return formatLocaleDate(date, locale, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "HH:MM:SS" or "HH:MM" -> "HH:MM". Defensive against malformed strings. */
export function formatDepartureTime(time: string): string {
  const parts = time.split(':');
  return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
}

/**
 * Minutes between the supplied {@code now} and a HH:MM(:SS) wall-clock
 * departure. Wraps across midnight: a scheduled time more than six
 * hours before {@code now} is interpreted as the next day's departure
 * (matches the {@code allArrivals} filter in kiosk / hub).
 */
export function getMinutesUntil(time: string, now: Date): number {
  const parts = time.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const departureMinutes = hours * 60 + minutes;

  let delta = departureMinutes - nowMinutes;
  if (delta < -360) { delta += 1440; }
  return Math.max(0, delta);
}

/** Departure is happening within the current minute. */
export function isImminent(time: string, now: Date): boolean {
  return getMinutesUntil(time, now) === 0;
}
