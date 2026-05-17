import { DestroyRef, Signal, computed, inject, signal } from '@angular/core';

import { injectVisibilityListener } from '@shared/browser/visibility-listener';
import { LocaleService } from '@core/i18n/locale.service';
import { formatClockDate, formatClockTime } from '@shared/utils/time.utils';

/** Anything older than 3 minutes triggers the "stale data" banner shared
 *  by hub + kiosk displays. Matches the constant the two components
 *  carried in their own files before the composable landed. */
const STALE_THRESHOLD_MS = 3 * 60 * 1000;

export interface DisplayClock {
  /** Wall-clock `Date` updated every second while the document is
   *  visible. Pauses when the tab moves to the background so a 24/7
   *  display doesn't burn CPU updating an off-screen value. */
  readonly now: Signal<Date>;
  /** Pre-formatted "HH:MM" using the active locale. Recomputes on
   *  every tick. */
  readonly currentTime: Signal<string>;
  /** Pre-formatted "Mon, Jan 1, 2026" using the active locale. */
  readonly currentDate: Signal<string>;
  /** `true` when `lastUpdate` is older than {@link STALE_THRESHOLD_MS}.
   *  Drives the stale-data banner. */
  isStale(lastUpdate: number | null): boolean;
  /** Minutes between {@code now()} and `lastUpdate`, floored. */
  staleMinutes(lastUpdate: number | null): number;
}

/**
 * Provides a 1Hz wall clock signal, pausing ticks when the document is
 * hidden. Hub and kiosk displays both consume it to drive time-based UI
 * (relative ETA, isStale banner, date/time header).
 *
 * Must be called from an injection context — it grabs `DestroyRef` and
 * the locale service so consumers don't have to remember teardown nor
 * re-wire locale formatting themselves.
 */
export function useDisplayClock(): DisplayClock {
  const visibility = injectVisibilityListener();
  const destroyRef = inject(DestroyRef);
  const localeService = inject(LocaleService);

  const now = signal(new Date());

  const refresh = (): void => {
    now.set(new Date());
  };

  let intervalId: ReturnType<typeof setInterval> | null = null;
  const start = (): void => {
    if (intervalId !== null) { return; }
    intervalId = setInterval(refresh, 1000);
  };
  const stop = (): void => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  start();
  visibility.onHidden(() => stop());
  visibility.onVisible(() => {
    refresh();
    start();
  });

  destroyRef.onDestroy(() => stop());

  const currentTime = computed(() => formatClockTime(now(), localeService.current()));
  const currentDate = computed(() => formatClockDate(now(), localeService.current()));

  return {
    now: now.asReadonly(),
    currentTime,
    currentDate,
    isStale(lastUpdate) {
      if (lastUpdate === null) { return false; }
      return now().getTime() - lastUpdate > STALE_THRESHOLD_MS;
    },
    staleMinutes(lastUpdate) {
      if (lastUpdate === null) { return 0; }
      return Math.floor((now().getTime() - lastUpdate) / 60000);
    },
  };
}
