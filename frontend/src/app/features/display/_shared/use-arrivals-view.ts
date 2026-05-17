import { Signal, computed } from '@angular/core';

/** Dwell time per visible row when the list scrolls — 4s gives a passenger
 *  in motion a comfortable beat to scan line + destination + time without
 *  feeling chased by the next row. Hub + kiosk shared this constant
 *  before the composable landed. */
const SECONDS_PER_ARRIVAL = 4;

/** Floor on the scroll cycle duration. Short lists with very few rows
 *  shouldn't whizz past — the eye needs at least 10s to settle. */
const MIN_SCROLL_SECONDS = 10;

/** Wrap an arrival whose `scheduledTime` looks earlier than `now` into
 *  the next day when the gap exceeds six hours. This handles night
 *  service that runs into early morning — anything older than 6h is
 *  treated as a genuinely past departure and dropped. Mirrors the
 *  `delta < -360 → +1440` rule the two components carried in their
 *  own files. */
const WRAP_THRESHOLD_MINUTES = -360;
const MINUTES_PER_DAY = 1440;

/** Common shape every display arrival fits — the filter only needs the
 *  scheduled HH:mm(:ss) string. Kept structural so both `ArrivalInfo`
 *  and `HubArrivalInfo` from `@shared/models` flow through without an
 *  adapter. */
export interface ScheduledArrival {
  readonly scheduledTime: string;
}

export interface ArrivalsViewConfig {
  /** Maximum rows that fit on screen before the list starts scrolling.
   *  Hub uses 8, kiosk uses 5. */
  readonly maxVisibleArrivals: number;
  /** Number of critical messages currently on-screen — they steal one
   *  row of vertical real estate each, so the threshold drops. */
  readonly criticalMessagesCount: number;
  /** Whether the info ticker is rendered. When absent the board gets
   *  one extra row before it has to scroll. */
  readonly hasInfoMessages: boolean;
  /** Optional override for the lower bound on `maxVisible` after the
   *  message penalty kicks in — hub goes down to 4, kiosk to 3. */
  readonly minVisibleArrivals?: number;
  /** Optional override for the upper bound — hub caps at 8, kiosk at 6. */
  readonly maxVisibleAfterPenalty?: number;
}

export interface ArrivalsView<A extends ScheduledArrival> {
  readonly allArrivals: readonly A[];
  readonly needsScrolling: boolean;
  /** Animation duration in CSS-friendly seconds, e.g. `"24s"`. */
  readonly scrollDuration: string;
}

/**
 * Filters an arrivals list to drop past departures (with midnight-wrap
 * tolerance) and tells the template whether the result needs to scroll
 * and for how long.
 *
 * Pure — easy to unit-test without TestBed. The signal-based wrapper
 * `useArrivalsView` consumes this directly.
 */
export function computeArrivalsView<A extends ScheduledArrival>(
  arrivals: readonly A[],
  now: Date,
  config: ArrivalsViewConfig,
): ArrivalsView<A> {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const filtered = arrivals.filter((arrival) => {
    const parts = arrival.scheduledTime.split(':');
    const arrivalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
    let delta = arrivalMinutes - currentMinutes;
    if (delta < WRAP_THRESHOLD_MINUTES) { delta += MINUTES_PER_DAY; }
    return delta >= 0;
  });

  const minVisible = config.minVisibleArrivals ?? Math.max(1, config.maxVisibleArrivals - 4);
  const maxAfterPenalty = config.maxVisibleAfterPenalty ?? config.maxVisibleArrivals;
  const maxVisible = Math.max(
    minVisible,
    Math.min(
      maxAfterPenalty,
      config.maxVisibleArrivals - config.criticalMessagesCount + (config.hasInfoMessages ? 0 : 1),
    ),
  );

  const needsScrolling = filtered.length > maxVisible;
  const seconds = Math.max(MIN_SCROLL_SECONDS, filtered.length * SECONDS_PER_ARRIVAL);

  return {
    allArrivals: filtered,
    needsScrolling,
    scrollDuration: `${seconds}s`,
  };
}

/**
 * Signal-based wrapper around `computeArrivalsView`. Use the pure
 * function directly in unit tests; this one keeps the consumer side
 * one line long.
 */
export function useArrivalsView<A extends ScheduledArrival>(
  arrivals: Signal<readonly A[]>,
  now: Signal<Date>,
  config: Signal<ArrivalsViewConfig>,
): Signal<ArrivalsView<A>> {
  return computed(() => computeArrivalsView(arrivals(), now(), config()));
}
