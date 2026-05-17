/**
 * Adds the realtime delay to the scheduled HH:mm so the relative
 * countdown and absolute time both reflect what the passenger
 * will actually see at the stop. The scheduled time on the
 * payload stays untouched — we only project it forward at the
 * render layer.
 *
 * Wraps into [0, 86400) so a late-night delay of 5 min on 23:58
 * displays as 00:03 the next day rather than 24:03.
 *
 * Extracted from `KioskComponent` so the projection can be unit-tested
 * without spinning up a TestBed.
 */
export function effectiveTime(arrival: {
  scheduledTime: string;
  realtimeDelaySeconds?: number | null;
}): string {
  const delay = arrival.realtimeDelaySeconds;
  if (delay === null || delay === undefined || delay === 0) {
    return arrival.scheduledTime;
  }
  const parts = arrival.scheduledTime.split(':');
  const hours = parseInt(parts[0] ?? '0', 10);
  const minutes = parseInt(parts[1] ?? '0', 10);
  const seconds = parseInt(parts[2] ?? '0', 10);
  const total = hours * 3600 + minutes * 60 + seconds + delay;
  const wrapped = ((total % 86400) + 86400) % 86400;
  const hh = Math.floor(wrapped / 3600);
  const mm = Math.floor((wrapped % 3600) / 60);
  const ss = wrapped % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
}
