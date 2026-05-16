import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
  effect,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DisplayService } from '@core/api/display.service';
import { ThemeService } from '@core/services/theme.service';
import { WebSocketService } from '@core/websocket/websocket.service';
import { ArrivalInfo, DisplayState, HubArrivalInfo, PickupKind } from '@shared/models';
import { lineTextColor } from '@shared/utils/color.utils';
import { LocaleService } from '@core/i18n/locale.service';
import {
  formatClockDate,
  formatClockTime,
  formatDepartureTime,
  getMinutesUntil,
  isImminent,
} from '@shared/utils/time.utils';

@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [
    NgOptimizedImage,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kiosk.component.html',
  styleUrl: './kiosk.component.scss',
})
export class KioskComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly wsService = inject(WebSocketService);
  private readonly transloco = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  private readonly destroyRef = inject(DestroyRef);
  /** Exposed to the template so the a11y toolbar can bind to its
   *  three signals (dark / contrast / large text) directly. */
  readonly themeService = inject(ThemeService);

  /** Cached on construction so the template's `[disabled]` binding
   *  doesn't probe the platform on every change-detection run. */
  readonly speechAvailable = typeof window !== 'undefined'
      && 'speechSynthesis' in window;

  displayState = signal<DisplayState | null>(null);
  error = signal<string | null>(null);
  currentTime = signal(this.formatTime(new Date()));
  currentDate = signal(this.formatDate(new Date()));

  // Exposed to the template so badges pick the server-resolved foreground
  // color (route_text_color from GTFS) before falling back to YIQ contrast.
  readonly lineTextColor = lineTextColor;

  /** Renders the frequency headway as a short "every X min" label.
   *  Null when the arrival is on a fixed timetable so the template
   *  skips the badge entirely. Headways under 60 seconds round to
   *  "every minute" — a strict 30s read would surprise passengers
   *  whose mental model is "minutes between buses". */
  frequencyLabel(headwaySeconds: number | null | undefined): string | null {
    if (!headwaySeconds || headwaySeconds <= 0) {return null;}
    const minutes = Math.round(headwaySeconds / 60);
    if (minutes <= 1) {return this.transloco.translate('kiosk.frequency.everyMinute');}
    return this.transloco.translate('kiosk.frequency.everyMinutes', { minutes });
  }

  /** Maps a {@link PickupKind} to a short label rendered next to the
   *  destination name. Returns null for {@code NORMAL} (no badge needed)
   *  and for unknown kinds so the template can use the {@code @if/as}
   *  pattern cleanly. */
  pickupBadge(kind: PickupKind | undefined): string | null {
    switch (kind) {
      case 'DROP_OFF_ONLY': return this.transloco.translate('kiosk.pickup.dropOffOnly');
      case 'PICKUP_ONLY': return this.transloco.translate('kiosk.pickup.pickupOnly');
      case 'ON_REQUEST_AGENCY': return this.transloco.translate('kiosk.pickup.onRequestAgency');
      case 'ON_REQUEST_DRIVER': return this.transloco.translate('kiosk.pickup.onRequestDriver');
      default: return null;
    }
  }

  /** Returns true when the GTFS-RT cache holds an explicit update
   *  for this arrival — even when the delay is zero ("on time"
   *  matters for passengers because it means the data is live, not
   *  theoretical). */
  isLive(delaySeconds: number | null | undefined): boolean {
    return delaySeconds !== null && delaySeconds !== undefined;
  }

  /** Short label rendered next to the live indicator: "à l'heure" / "on time",
   *  "+3 min", "−2 min". Sub-minute values collapse to the "on time" key
   *  to avoid screen churn at 30 s granularity. */
  liveLabel(delaySeconds: number | null | undefined): string {
    if (delaySeconds === null || delaySeconds === undefined) {return '';}
    const sign = delaySeconds >= 0 ? '+' : '−';
    const abs = Math.round(Math.abs(delaySeconds) / 60);
    if (abs === 0) {return this.transloco.translate('kiosk.onTime');}
    return `${sign}${abs} min`;
  }

  /** Announces the very first arrival on the board through the
   *  browser's Web Speech API. Used by the assistive button on the
   *  kiosk header. Falls through silently when no arrivals are
   *  available or the platform doesn't ship a synthesiser — the
   *  template gates the button on {@link speechAvailable} but a
   *  defensive check stays cheap. */
  speakNextDeparture(): void {
    const next = this.allArrivals()[0];
    if (!next) {
      this.speak(this.transloco.translate('kiosk.speak.noArrivals'));
      return;
    }
    const time = this.formatScheduledTime(next.scheduledTime);
    const delay = next.realtimeDelaySeconds ?? null;
    const params = { line: next.line.code, destination: next.destinationName, time };
    let text: string;
    if (delay === null) {
      text = this.transloco.translate('kiosk.speak.next', params);
    } else if (delay === 0) {
      text = this.transloco.translate('kiosk.speak.nextOnTime', params);
    } else if (delay > 0) {
      text = this.transloco.translate('kiosk.speak.nextDelayed', { ...params, minutes: Math.round(delay / 60) });
    } else {
      text = this.transloco.translate('kiosk.speak.nextEarly', { ...params, minutes: Math.round(Math.abs(delay) / 60) });
    }
    this.speak(text);
  }

  /** Wraps {@code window.speechSynthesis} so the speak handlers stay
   *  one-liners. Cancels any in-flight utterance first so a rapid
   *  double-press never queues two spoken announcements on top of
   *  each other. The BCP-47 tag is sourced from the active i18n
   *  bundle so an EN-resolved kiosk doesn't get a French voice. */
  private speak(text: string): void {
    if (!this.speechAvailable) {return;}
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.transloco.translate('kiosk.speak.bcp47');
    utterance.rate = 0.95;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  /** Pretty-prints a GTFS time string (HH:mm:ss or HH:mm) for vocal
   *  output. The synthesiser handles bare digits poorly ("zero
   *  eight forty-two"); the localised template wraps them in the
   *  natural-sounding wording for the active language ("huit heures
   *  quarante-deux" / "08:42"). */
  private formatScheduledTime(raw: string): string {
    const trimmed = raw.length >= 5 ? raw.substring(0, 5) : raw;
    const [hh = '0', mm = '00'] = trimmed.split(':');
    return this.transloco.translate('kiosk.speak.time', { hh: parseInt(hh, 10), mm });
  }

  /** True when the per-arrival platform_code adds information vs.
   *  the kiosk's stop-level platform_code. On a per-platform kiosk
   *  the two match and rendering would be noise; on a parent-station
   *  kiosk the per-arrival value varies and is critical info. */
  showPerArrivalPlatform(arrival: ArrivalInfo): boolean {
    const arrivalPlatform = arrival.platformCode;
    if (!arrivalPlatform) {return false;}
    const stopPlatform = this.displayState()?.stopPlatformCode ?? null;
    return stopPlatform !== arrivalPlatform;
  }

  /** ARIA label for the booking badge — screen readers announce
   *  "réservation 0123456789, 30 minutes minimum" rather than just
   *  "phone_callback 0123456789". */
  bookingAria(b: { phone: string | null; priorNoticeMinutes: number | null }): string {
    const parts: string[] = [this.transloco.translate('kiosk.booking.aria')];
    if (b.phone) {parts.push(b.phone);}
    if (b.priorNoticeMinutes) {
      parts.push(this.transloco.translate('kiosk.booking.minMinutes', { minutes: b.priorNoticeMinutes }));
    }
    return parts.join(', ');
  }

  /** Adds the realtime delay to the scheduled HH:mm so the relative
   *  countdown and absolute time both reflect what the passenger
   *  will actually see at the stop. The scheduled time on the
   *  payload stays untouched — we only project it forward at the
   *  render layer. */
  effectiveTime(arrival: ArrivalInfo | HubArrivalInfo): string {
    const delay = arrival.realtimeDelaySeconds;
    if (delay === null || delay === undefined || delay === 0) {
      return arrival.scheduledTime;
    }
    const parts = arrival.scheduledTime.split(':');
    const hours = parseInt(parts[0] ?? '0', 10);
    const minutes = parseInt(parts[1] ?? '0', 10);
    const seconds = parseInt(parts[2] ?? '0', 10);
    const total = hours * 3600 + minutes * 60 + seconds + delay;
    // Wrap into [0, 86400) so a late-night delay of 5 min on 23:58
    // displays as 00:03 the next day rather than 24:03.
    const wrapped = ((total % 86400) + 86400) % 86400;
    const hh = Math.floor(wrapped / 3600);
    const mm = Math.floor((wrapped % 3600) / 60);
    const ss = wrapped % 60;
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`;
  }

  constructor() {
    // Initialise the reducedMotion signal from the media query. A change
    // listener keeps the signal in sync if the user toggles the OS setting
    // while the kiosk is running (e.g. on a shared-use accessibility kiosk).
    this.mql = typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)')
      : null;
    this.reducedMotion = signal(this.mql?.matches ?? false);
    if (this.mql) {
      this.mqlChangeHandler = (e: MediaQueryListEvent) => {
        this.reducedMotion.set(e.matches);
      };
      this.mql.addEventListener('change', this.mqlChangeHandler);
    }

    // When reduced-motion is active, advance the page index at a fixed interval
    // so arrivals that scroll off in normal mode are still reachable.
    effect(() => {
      if (this.reducedMotion()) {
        this.startPageSwap();
      } else {
        this.stopPageSwap();
        this.pageIndex.set(0);
      }
    });

    // Reset page index when the arrival list changes (stop switch, WS update)
    // so we don't land on an empty page.
    effect(() => {
      const total = this.allArrivals().length;
      const pageSize = KioskComponent.MAX_VISIBLE_ARRIVALS;
      const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      if (this.pageIndex() > maxPage) {
        this.pageIndex.set(0);
      }
    });
  }

  private token: string | null = null;
  private stopId: string | null = null;
  private deviceId: string | null = null;
  private timeInterval: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  private mql: MediaQueryList | null = null;
  private mqlChangeHandler: ((e: MediaQueryListEvent) => void) | null = null;
  /** Wall-clock timestamp of the most recent state update (initial fetch or
   *  WebSocket push). Used to surface "data is stale" when the WS link is
   *  technically open but the backend has gone quiet (deleted stop, etc.). */
  lastUpdate = signal<number | null>(null);
  /** Threshold past which we consider the displayed state stale: 3 minutes.
   *  Long enough to ride out normal WS gaps, short enough to warn passengers
   *  before they trust ghost departures. */
  private static readonly STALE_THRESHOLD_MS = 3 * 60 * 1000;
  /** Re-evaluates against currentTime so the banner appears even if no new
   *  state ever arrives — the 1s clock signal drives the recompute. */
  isStale = computed(() => {
    this.currentTime();
    const last = this.lastUpdate();
    if (last === null) { return false; }
    return Date.now() - last > KioskComponent.STALE_THRESHOLD_MS;
  });
  /** Minutes since the last update, formatted for the banner. */
  staleMinutes = computed(() => {
    this.currentTime();
    const last = this.lastUpdate();
    if (last === null) { return 0; }
    return Math.floor((Date.now() - last) / 60000);
  });

  // Maximum arrivals that fit on screen without scrolling
  private static readonly MAX_VISIBLE_ARRIVALS = 5;
  // Seconds to display each arrival during scroll
  // Dwell time per visible arrival when the list scrolls. 4s gives a passenger
  // in motion a comfortable beat to scan line + destination + time without
  // feeling chased by the next row.
  private static readonly SECONDS_PER_ARRIVAL = 4;
  // Seconds between page-swaps in reduced-motion mode. 8s per page gives a
  // passenger enough time to read all rows before the next set appears.
  private static readonly REDUCED_MOTION_PAGE_DWELL_MS = 8000;

  /** True when the OS/browser signals that animations should be minimised.
   *  Reactive: updated via a MediaQueryList change event so the signal stays
   *  in sync even if the user toggles the system preference mid-session. */
  reducedMotion: ReturnType<typeof signal<boolean>>;

  /** Current page index for the paginated view used under reduced-motion. */
  private readonly pageIndex = signal(0);

  /** Page-swap interval reference — held so we can clear it on destroy. */
  private pageInterval: ReturnType<typeof setInterval> | null = null;

  // All arrivals from display state, filtered to exclude past departures
  allArrivals = computed(() => {
    // Re-evaluate when time changes
    this.currentTime();

    const arrivals = this.displayState()?.arrivals ?? [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return arrivals.filter(arrival => {
      const parts = arrival.scheduledTime.split(':');
      const arrivalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
      // Wrap arrivals across midnight: when the scheduled time looks earlier than
      // `now` and the gap is large (>6h), treat it as tomorrow's arrival (night
      // service running into early morning). Anything older than 6h is genuinely
      // past and gets dropped.
      let delta = arrivalMinutes - currentMinutes;
      if (delta < -360) { delta += 1440; }
      return delta >= 0;
    });
  });

  /** Arrivals shown in the template. Under normal motion shows all arrivals
   *  (the CSS scroll animation handles overflow). Under reduced-motion, shows
   *  a page-sized slice that rotates every REDUCED_MOTION_PAGE_DWELL_MS so
   *  content that would scroll off is still reachable. */
  visibleArrivals = computed(() => {
    const all = this.allArrivals();
    if (!this.reducedMotion()) { return all; }
    const pageSize = KioskComponent.MAX_VISIBLE_ARRIVALS;
    const start = this.pageIndex() * pageSize;
    return all.slice(start, start + pageSize);
  });

  // Whether we need vertical scrolling (more arrivals than fit on screen).
  // Always false under reduced-motion — pagination replaces continuous scroll.
  needsScrolling = computed(() => {
    if (this.reducedMotion()) { return false; }
    const arrivals = this.allArrivals();
    const criticalCount = this.criticalMessages().length;
    const hasInfoMessages = this.infoMessages().length > 0;
    // Adjust visible count based on messages (same logic as before)
    const maxVisible = Math.max(3, Math.min(6, KioskComponent.MAX_VISIBLE_ARRIVALS - criticalCount + (hasInfoMessages ? 0 : 1)));
    return arrivals.length > maxVisible;
  });

  // Duration for one complete scroll cycle
  scrollDuration = computed(() => {
    const arrivals = this.allArrivals();
    // Time proportional to number of arrivals
    const duration = arrivals.length * KioskComponent.SECONDS_PER_ARRIVAL;
    return `${Math.max(10, duration)}s`;
  });

  criticalMessages = computed(() =>
    (this.displayState()?.messages ?? []).filter(
      (m) => m.severity === 'CRITICAL'
    )
  );

  infoMessages = computed(() =>
    (this.displayState()?.messages ?? []).filter(
      (m) => m.severity !== 'CRITICAL'
    )
  );

  // Calculate ticker scroll duration based on content length (slower = more readable)
  tickerDuration = computed(() => {
    const messages = this.infoMessages();
    const totalLength = messages.reduce((acc, m) =>
      acc + m.title.length + m.content.length, 0
    );
    // Base: 20s, add 2s per 50 characters for readability
    // Info ticker: shorter base (12s) than before so brief messages don't
    // hang on screen for a full 20s every cycle. Still grows with content.
    const duration = Math.max(10, 12 + Math.floor(totalLength / 50) * 2);
    return `${duration}s`;
  });

  // Calculate alert scroll duration (slower than info ticker for critical messages)
  alertDuration = computed(() => {
    const messages = this.criticalMessages();
    const totalLength = messages.reduce((acc, m) =>
      acc + m.title.length + m.content.length, 0
    );
    // Slower pace for critical messages: 15s base, add 3s per 50 chars
    const duration = Math.max(12, 15 + Math.floor(totalLength / 50) * 3);
    return `${duration}s`;
  });

  connected = computed(
    () => this.wsService.connectionState() === 'CONNECTED'
  );

  ngOnInit(): void {
    this.route.params.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const routeStopId = String(params['stopId'] ?? '');
      if (routeStopId) {
        this.stopId = routeStopId;
        this.initializeWithStopId();
      }
    });

    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      this.token = String(params['token'] ?? '') || null;
      const queryStopId = String(params['stopId'] ?? '') || null;

      if (this.token) {
        this.initializeWithToken();
      } else if (queryStopId && !this.stopId) {
        this.stopId = queryStopId;
        this.initializeWithStopId();
      } else if (!this.stopId && !this.token) {
        this.error.set(this.transloco.translate('kiosk.errors.missingDeviceOrStop'));
      }
    });

    this.startClock();
    // Pause the clock while the tab is hidden — kiosks running 24/7 don't need
    // to burn CPU updating an off-screen clock once a second.
    this.visibilityHandler = () => {
      if (document.hidden) {
        this.stopClock();
      } else {
        this.refreshClock();
        this.startClock();
      }
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  ngOnDestroy(): void {
    this.stopClock();
    this.stopPageSwap();
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    if (this.mql && this.mqlChangeHandler) {
      this.mql.removeEventListener('change', this.mqlChangeHandler);
      this.mql = null;
      this.mqlChangeHandler = null;
    }
    this.wsService.disconnect();
  }

  private startPageSwap(): void {
    if (this.pageInterval !== null) { return; }
    this.pageInterval = setInterval(() => {
      const total = this.allArrivals().length;
      const pageSize = KioskComponent.MAX_VISIBLE_ARRIVALS;
      const maxPage = Math.max(0, Math.ceil(total / pageSize) - 1);
      this.pageIndex.set(this.pageIndex() < maxPage ? this.pageIndex() + 1 : 0);
    }, KioskComponent.REDUCED_MOTION_PAGE_DWELL_MS);
  }

  private stopPageSwap(): void {
    if (this.pageInterval !== null) {
      clearInterval(this.pageInterval);
      this.pageInterval = null;
    }
  }

  private startClock(): void {
    if (this.timeInterval !== null) { return; }
    this.timeInterval = setInterval(() => this.refreshClock(), 1000);
  }

  private stopClock(): void {
    if (this.timeInterval !== null) {
      clearInterval(this.timeInterval);
      this.timeInterval = null;
    }
  }

  private refreshClock(): void {
    const now = new Date();
    this.currentTime.set(this.formatTime(now));
    this.currentDate.set(this.formatDate(now));
  }

  private initializeWithToken(): void {
    if (!this.token) {
      return;
    }
    this.displayService.getStateByToken(this.token).subscribe({
      next: (authenticated) => {
        this.deviceId = authenticated.deviceId;
        this.displayState.set(authenticated.state);
        this.lastUpdate.set(Date.now());
        this.subscribeToUpdates(authenticated.state.stopId);
      },
      error: () => {
        this.error.set(this.transloco.translate('kiosk.errors.invalidToken'));
      },
    });
  }

  private initializeWithStopId(): void {
    if (!this.stopId) {
      return;
    }
    const stopId = this.stopId;
    this.displayService.getState(stopId).subscribe({
      next: (state) => {
        this.displayState.set(state);
        this.lastUpdate.set(Date.now());
        this.subscribeToUpdates(stopId);
      },
      error: () => {
        this.error.set(this.transloco.translate('kiosk.errors.stopNotFound'));
      },
    });
  }

  private subscribeToUpdates(stopId: string): void {
    this.wsService.connect(stopId, this.deviceId).subscribe({
      next: (state) => this.applyState(state),
      error: (err) => {
        console.error('WebSocket error:', err);
      },
    });

    // After a WebSocket interruption, the broker may have skipped pushes
    // (e.g. a stop was renamed, a message expired) — fetch a fresh snapshot
    // so the kiosk doesn't keep showing pre-disconnect state until the next
    // server-driven event.
    this.wsService.reconnected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.refetchSnapshot(stopId));
  }

  /** Accept a state only if its version is monotone — drops out-of-order pushes
   *  that arrive after a newer one (broker queue reordering, retried fan-out).
   *  We still bump lastUpdate so the kiosk doesn't drift into "stale" state. */
  private applyState(state: DisplayState): void {
    const current = this.displayState();
    if (current && state.version < current.version) {
      this.lastUpdate.set(Date.now());
      return;
    }
    this.displayState.set(state);
    this.lastUpdate.set(Date.now());
  }

  /** Like applyState but unconditional: used right after reconnect/refetch when
   *  the version counter may have reset (backend restart, in-memory `versionMap`
   *  starting fresh). Without this the kiosk would freeze on stale data,
   *  rejecting every fresh state because its number is "lower" than the cached
   *  pre-restart one. */
  private resetState(state: DisplayState): void {
    this.displayState.set(state);
    this.lastUpdate.set(Date.now());
  }

  private refetchSnapshot(stopId: string): void {
    if (this.token) {
      this.displayService.getStateByToken(this.token).subscribe({
        next: (auth) => this.resetState(auth.state),
        error: (err: unknown) => {
          console.error('Failed to refresh snapshot after reconnect:', err);
        },
      });
    } else {
      this.displayService.getState(stopId).subscribe({
        next: (state) => this.resetState(state),
        error: (err: unknown) => {
          console.error('Failed to refresh snapshot after reconnect:', err);
        },
      });
    }
  }

  private formatTime(date: Date): string {
    return formatClockTime(date, this.localeService.current());
  }

  private formatDate(date: Date): string {
    return formatClockDate(date, this.localeService.current());
  }

  formatDepartureTime(time: string): string {
    return formatDepartureTime(time);
  }

  getMinutesUntil(time: string): number {
    // Trigger recalculation when currentTime changes
    this.currentTime();
    return getMinutesUntil(time, new Date());
  }

  formatRelativeTime(time: string): string {
    const minutes = this.getMinutesUntil(time);
    if (minutes === 0) {
      return this.transloco.translate('kiosk.imminent');
    }
    return this.transloco.translate('kiosk.minutesShort', { minutes });
  }

  /** Whether the next departure is happening now (within the same minute).
   *  Drives the highlighted `.imminent` styling on the relative-time pill. */
  isImminent(time: string): boolean {
    // Trigger recalculation when currentTime changes
    this.currentTime();
    return isImminent(time, new Date());
  }
}
