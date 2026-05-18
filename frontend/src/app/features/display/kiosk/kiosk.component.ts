import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
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
import { DisplayAlertBannerComponent } from '@shared/components/display-alert-banner/display-alert-banner.component';
import { DisplayInfoTickerComponent } from '@shared/components/display-info-ticker/display-info-ticker.component';
import { ArrivalInfo, DisplayState, HubArrivalInfo, PickupKind } from '@shared/models';
import { lineTextColor } from '@shared/utils/color.utils';
import {
  formatDepartureTime,
  getMinutesUntil,
  isImminent as isImminentTimeUtil,
} from '@shared/utils/time.utils';

import { DisplayDeparturesRowComponent } from '../_shared/display-departures-row/display-departures-row.component';
import { useArrivalsView } from '../_shared/use-arrivals-view';
import { useDisplayClock } from '../_shared/use-display-clock';
import { useMessagesView } from '../_shared/use-messages-view';
import { usePageSwap, type PageSwap } from '../_shared/use-page-swap';
import { useReducedMotion } from '../_shared/use-reduced-motion';

import { effectiveTime } from './kiosk-arrival';
import { speak, speakNextDepartureText } from './kiosk-speech';

/** Seconds between page-swaps in reduced-motion mode. 8s per page gives
 *  a passenger enough time to read all rows before the next set appears. */
const REDUCED_MOTION_PAGE_DWELL_MS = 8000;
/** Maximum arrivals that fit on screen without scrolling. */
const MAX_VISIBLE_ARRIVALS = 5;

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
    DisplayAlertBannerComponent,
    DisplayInfoTickerComponent,
    DisplayDeparturesRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kiosk.component.html',
  styleUrl: './kiosk.component.scss',
})
export class KioskComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly wsService = inject(WebSocketService);
  private readonly transloco = inject(TranslocoService);
  private readonly destroyRef = inject(DestroyRef);
  /** Exposed to the template so the a11y toolbar can bind to its
   *  three signals (dark / contrast / large text) directly. */
  readonly themeService = inject(ThemeService);

  /** Shared 1Hz wall clock — pauses while the tab is hidden, exposes
   *  pre-formatted date/time strings and the isStale helpers. */
  protected readonly clock = useDisplayClock();
  protected readonly currentTime = this.clock.currentTime;
  protected readonly currentDate = this.clock.currentDate;

  /** Cached on construction so the template's `[disabled]` binding
   *  doesn't probe the platform on every change-detection run. */
  readonly speechAvailable = typeof window !== 'undefined'
      && 'speechSynthesis' in window;

  displayState = signal<DisplayState | null>(null);
  error = signal<string | null>(null);

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
    if (!this.speechAvailable) {return;}
    const text = speakNextDepartureText(this.transloco, this.allArrivals()[0]);
    speak(this.transloco, text);
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

  /** Template wrapper around the pure {@link effectiveTime} helper. */
  effectiveTime(arrival: ArrivalInfo | HubArrivalInfo): string {
    return effectiveTime(arrival);
  }

  constructor() {
    this.destroyRef.onDestroy(() => this.wsService.disconnect());
  }

  // ngOnInit kept on purpose: the route param + query param subscribes
  // need synchronous Subject-driven semantics for the existing tests
  // (they call `subject.next()` and assert immediately). Migrating
  // those to effect + toSignal would require a fixture.detectChanges()
  // tick after every emission, which is a sweeping spec-rewrite that
  // belongs to its own change.
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
  }

  private token: string | null = null;
  private stopId: string | null = null;
  private deviceId: string | null = null;
  /** Wall-clock timestamp of the most recent state update (initial fetch or
   *  WebSocket push). Used to surface "data is stale" when the WS link is
   *  technically open but the backend has gone quiet (deleted stop, etc.). */
  lastUpdate = signal<number | null>(null);
  isStale = computed(() => this.clock.isStale(this.lastUpdate()));
  staleMinutes = computed(() => this.clock.staleMinutes(this.lastUpdate()));

  /** True when the OS/browser signals that animations should be minimised.
   *  Reactive: the underlying MediaQueryList listener updates the signal
   *  if the user toggles the system preference mid-session. */
  readonly reducedMotion = useReducedMotion();

  /** Split of messages into critical / info plus the two scroll-cycle
   *  durations the banner + ticker bind to. */
  private readonly messagesSignal = computed(() => this.displayState()?.messages ?? []);
  protected readonly messagesView = useMessagesView(this.messagesSignal);
  criticalMessages = computed(() => this.messagesView().critical);
  infoMessages = computed(() => this.messagesView().info);
  tickerDuration = computed(() => this.messagesView().tickerDuration);
  alertDuration = computed(() => this.messagesView().alertDuration);

  /** Filter + scroll metrics for the arrivals list. Kiosk caps visible
   *  rows at 5 by default, dropping to 3 once critical messages steal
   *  real estate (`5 - criticalCount + (hasInfoMessages ? 0 : 1)`,
   *  clamped to `[3, 6]`). */
  private readonly arrivalsSignal = computed(() => this.displayState()?.arrivals ?? []);
  private readonly arrivalsConfigSignal = computed(() => ({
    maxVisibleArrivals: MAX_VISIBLE_ARRIVALS,
    minVisibleArrivals: 3,
    maxVisibleAfterPenalty: 6,
    criticalMessagesCount: this.criticalMessages().length,
    hasInfoMessages: this.infoMessages().length > 0,
  }));
  protected readonly arrivalsView = useArrivalsView(this.arrivalsSignal, this.clock.now, this.arrivalsConfigSignal);
  allArrivals = computed(() => this.arrivalsView().allArrivals);

  /** Pagination helper used only under reduced motion: the composable
   *  starts / stops the rotating timer based on {@link reducedMotion}
   *  and snaps the page back to 0 when the arrival list shrinks. */
  private readonly pageSwap: PageSwap = usePageSwap(
    this.reducedMotion,
    computed(() => Math.max(1, Math.ceil(this.allArrivals().length / MAX_VISIBLE_ARRIVALS))),
    REDUCED_MOTION_PAGE_DWELL_MS,
  );

  /** Arrivals shown in the template. Under normal motion shows all arrivals
   *  (the CSS scroll animation handles overflow). Under reduced-motion, shows
   *  a page-sized slice that rotates every REDUCED_MOTION_PAGE_DWELL_MS so
   *  content that would scroll off is still reachable. */
  visibleArrivals = computed(() => {
    const all = this.allArrivals();
    if (!this.reducedMotion()) { return all; }
    const start = this.pageSwap.pageIndex() * MAX_VISIBLE_ARRIVALS;
    return all.slice(start, start + MAX_VISIBLE_ARRIVALS);
  });

  // Whether we need vertical scrolling (more arrivals than fit on screen).
  // Always false under reduced-motion — pagination replaces continuous scroll.
  needsScrolling = computed(() => {
    if (this.reducedMotion()) { return false; }
    return this.arrivalsView().needsScrolling;
  });

  scrollDuration = computed(() => this.arrivalsView().scrollDuration);

  connected = computed(
    () => this.wsService.connectionState() === 'CONNECTED'
  );

  /** Wrapper exposed for the existing template + spec call sites. */
  formatDepartureTime(time: string): string {
    return formatDepartureTime(time);
  }

  /** Wrapper exposed for the existing spec assertions. Reads `new Date()`
   *  directly so test specs that fake the system clock via
   *  `vi.useFakeTimers({ toFake: ['Date'] })` + `vi.setSystemTime(...)`
   *  pick up the frozen value immediately, without waiting for the
   *  shared clock signal's 1Hz tick to land. */
  getMinutesUntil(time: string): number {
    // Reading the signal keeps consumers reactive on the 1Hz tick.
    this.clock.now();
    return getMinutesUntil(time, new Date());
  }

  /** Format the relative-time label rendered on each row. Templates
   *  bind to {@code formatRelativeTime(time)} but the new shared row
   *  computes the same thing internally — this stays around for the
   *  kiosk-only template loop (per-arrival platform badge) and for
   *  the existing spec assertions. */
  formatRelativeTime(time: string): string {
    const minutes = this.getMinutesUntil(time);
    if (minutes === 0) {
      return this.transloco.translate('kiosk.imminent');
    }
    return this.transloco.translate('kiosk.minutesShort', { minutes });
  }

  /** Whether the next departure is happening within the current minute.
   *  Drives the highlighted `.imminent` styling on the relative-time pill. */
  isImminent(time: string): boolean {
    this.clock.now();
    return isImminentTimeUtil(time, new Date());
  }

  /** ARIA label for the booking badge — screen readers announce
   *  "réservation 0123456789, ≥ 30 min" rather than just
   *  "phone_callback 0123456789". The shared row carries its own
   *  copy but the kiosk template's per-row override (when phone is
   *  null, etc.) still binds to this helper. */
  bookingAria(b: { phone: string | null; priorNoticeMinutes: number | null }): string {
    const parts: string[] = [this.transloco.translate('kiosk.booking.aria')];
    if (b.phone) {parts.push(b.phone);}
    if (b.priorNoticeMinutes) {
      parts.push(this.transloco.translate('kiosk.booking.minMinutes', { minutes: b.priorNoticeMinutes }));
    }
    return parts.join(', ');
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
}
