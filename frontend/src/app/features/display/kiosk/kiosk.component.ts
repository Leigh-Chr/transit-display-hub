import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DisplayService } from '@core/api/display.service';
import { WebSocketService } from '@core/websocket/websocket.service';
import { DisplayState } from '@shared/models';

@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kiosk">
      @if (displayState()) {
        <!-- Header: Stop name with line badges + Current time -->
        <header class="header">
          <img src="assets/logo.png" alt="" class="header-logo">
          <div class="stop-info">
            <h1 class="stop-name">{{ displayState()!.stopName }}</h1>
            <div class="header-lines">
              @for (line of displayState()!.lines; track line.code) {
                <span class="header-line-badge" [style.backgroundColor]="line.color">
                  {{ line.code }}
                </span>
              }
            </div>
          </div>
          <div class="clock-container">
            <div class="date">{{ currentDate() }}</div>
            <div class="clock">{{ currentTime() }}</div>
          </div>
        </header>

        <!-- Critical alert (scrolling banner) -->
        @if (criticalMessages().length > 0) {
          <div class="alert-banner">
            <div class="alert-icon">
              <mat-icon>warning</mat-icon>
            </div>
            <div class="alert-wrapper">
              <div class="alert-track" [style.animationDuration]="alertDuration()">
                <div class="alert-content">
                  @for (message of criticalMessages(); track $index) {
                    <span class="alert-item">
                      <strong>{{ message.title }}</strong>
                      @if (message.content) {
                        <span class="alert-detail">— {{ message.content }}</span>
                      }
                    </span>
                    <span class="alert-separator">•</span>
                  }
                </div>
                <div class="alert-content">
                  @for (message of criticalMessages(); track $index) {
                    <span class="alert-item">
                      <strong>{{ message.title }}</strong>
                      @if (message.content) {
                        <span class="alert-detail">— {{ message.content }}</span>
                      }
                    </span>
                    <span class="alert-separator">•</span>
                  }
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Main departures board -->
        <main class="departures">
          <div class="departures-header">
            <span class="col-line">Line</span>
            <span class="col-destination">Destination</span>
            <span class="col-time">Next departure</span>
          </div>
          <div class="departures-viewport">
            <div class="departures-track"
                 [class.scrolling]="needsScrolling()"
                 [style.animationDuration]="scrollDuration()">
              <div class="departures-list">
                @for (arrival of allArrivals(); track (arrival.line.code + '-' + arrival.destinationName)) {
                  <div class="departure-row">
                    <span
                      class="line-badge"
                      [style.backgroundColor]="arrival.line.color"
                    >
                      {{ arrival.line.code }}
                    </span>
                    <span class="destination">{{ arrival.destinationName }}</span>
                    <span class="time-info">
                      <span
                        class="time-relative"
                        [class.imminent]="isImminent(arrival.scheduledTime)"
                      >{{ formatRelativeTime(arrival.scheduledTime) }}</span>
                      <span class="time-absolute">{{ formatDepartureTime(arrival.scheduledTime) }}</span>
                    </span>
                  </div>
                } @empty {
                  <div class="no-departures">
                    No scheduled departures
                  </div>
                }
              </div>
              <!-- Duplicate for seamless loop when scrolling -->
              @if (needsScrolling()) {
                <div class="list-divider"></div>
                <div class="departures-list">
                  @for (arrival of allArrivals(); track (arrival.line.code + '-' + arrival.destinationName)) {
                    <div class="departure-row">
                      <span
                        class="line-badge"
                        [style.backgroundColor]="arrival.line.color"
                      >
                        {{ arrival.line.code }}
                      </span>
                      <span class="destination">{{ arrival.destinationName }}</span>
                      <span class="time-info">
                        <span
                        class="time-relative"
                        [class.imminent]="isImminent(arrival.scheduledTime)"
                      >{{ formatRelativeTime(arrival.scheduledTime) }}</span>
                        <span class="time-absolute">{{ formatDepartureTime(arrival.scheduledTime) }}</span>
                      </span>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </main>

        <!-- Info/Warning messages ticker -->
        @if (infoMessages().length > 0) {
          <aside class="info-ticker">
            <div class="ticker-track" [style.animationDuration]="tickerDuration()">
              <div class="ticker-content">
                @for (message of infoMessages(); track $index) {
                  <span class="ticker-item" [class.ticker-warning]="message.severity === 'WARNING'">
                    <mat-icon>{{ message.severity === 'WARNING' ? 'warning' : 'info' }}</mat-icon>
                    <strong>{{ message.title }}</strong>
                    @if (message.content) {
                      <span class="ticker-detail">{{ message.content }}</span>
                    }
                  </span>
                  <span class="ticker-separator">•</span>
                }
              </div>
              <!-- Duplicate for seamless loop -->
              <div class="ticker-content">
                @for (message of infoMessages(); track $index) {
                  <span class="ticker-item" [class.ticker-warning]="message.severity === 'WARNING'">
                    <mat-icon>{{ message.severity === 'WARNING' ? 'warning' : 'info' }}</mat-icon>
                    <strong>{{ message.title }}</strong>
                    @if (message.content) {
                      <span class="ticker-detail">{{ message.content }}</span>
                    }
                  </span>
                  <span class="ticker-separator">•</span>
                }
              </div>
            </div>
          </aside>
        }

        <!-- Connection status indicator (minimal) -->
        @if (!connected()) {
          <div class="connection-warning" role="status" aria-live="polite">
            <mat-icon aria-hidden="true">wifi_off</mat-icon>
            Reconnecting...
          </div>
        } @else if (isStale()) {
          <div class="connection-warning stale-warning" role="status" aria-live="polite">
            <mat-icon aria-hidden="true">schedule</mat-icon>
            Last update {{ staleMinutes() }}m ago
          </div>
        }
      } @else if (error()) {
        <div class="error-state">
          <mat-icon>error_outline</mat-icon>
          <h1>Display Error</h1>
          <p>{{ error() }}</p>
        </div>
      } @else {
        <div class="loading-state">
          <mat-spinner diameter="80" aria-label="Loading display"></mat-spinner>
          <h1>Loading...</h1>
        </div>
      }
    </div>
  `,
  styles: `
    /* ===========================================
       KIOSK DISPLAY - Optimized for readability
       Target: 1920x1080 screens, 3-5m viewing distance
       =========================================== */

    :host {
      display: block;
      background: var(--app-kiosk-surface);
      color: var(--app-kiosk-on-surface);
      min-height: 100vh;
      -webkit-font-smoothing: antialiased;
    }

    .kiosk {
      height: 100vh;
      display: flex;
      flex-direction: column;
      padding: 2vh 2.5vw;
      box-sizing: border-box;
    }

    /* --- Header --- */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 1.5vh;
      border-bottom: 0.4vh solid var(--app-kiosk-border);
      margin-bottom: 1.5vh;
      gap: 2vw;
    }

    .header-logo {
      width: 5vh;
      height: 5vh;
      flex-shrink: 0;
      filter: brightness(0) invert(1);
      opacity: 0.9;
    }

    .stop-name {
      font-size: 6vh;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .header-lines {
      display: flex;
      gap: 0.8vw;
      margin-top: 0.8vh;
    }

    .header-line-badge {
      padding: 0.5vh 1vw;
      border-radius: 0.5vh;
      font-size: 3vh;
      font-weight: 700;
      color: var(--app-kiosk-on-surface);
      text-shadow: 0 1px 2px var(--app-kiosk-text-shadow);
    }

    .clock-container {
      text-align: right;
    }

    .date {
      font-size: 3vh;
      font-weight: 500;
      color: var(--app-kiosk-on-surface-muted);
      margin-bottom: 0.5vh;
    }

    .clock {
      font-size: 8vh;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }

    /* --- Alert Banner (scrolling) --- */
    .alert-banner {
      display: flex;
      align-items: center;
      background: var(--app-kiosk-alert-bg);
      margin-bottom: 1vh;
      border-radius: 0.5vh;
    }

    .alert-icon {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1.2vh 1.5vw;
      flex-shrink: 0;
    }

    .alert-icon mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
    }

    .alert-wrapper {
      flex: 1;
      overflow: hidden;
      padding: 1.2vh 0;
      padding-right: 2vw;
    }

    .alert-track {
      display: flex;
      animation: alert-scroll linear infinite;
      width: max-content;
    }

    .alert-content {
      display: flex;
      align-items: center;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .alert-item {
      font-size: 3vh;
      line-height: 1.3;
    }

    .alert-item strong {
      font-weight: 700;
    }

    .alert-detail {
      opacity: 0.9;
      margin-left: 0.5vw;
    }

    .alert-separator {
      margin: 0 2vw;
      opacity: 0.5;
    }

    @keyframes alert-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    /* --- Departures Board --- */
    .departures {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
      overflow: hidden;
    }

    .departures-header {
      display: flex;
      align-items: center;
      padding: 1vh 1vw;
      font-size: 3vh;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: var(--app-kiosk-on-surface-muted);
      border-bottom: 0.1vh solid var(--app-kiosk-border-subtle);
      flex-shrink: 0;
    }

    .col-line {
      width: 8vw;
      text-align: center;
    }

    .col-destination {
      flex: 1;
      padding-left: 2vw;
    }

    .col-time {
      min-width: 22vw;
      text-align: right;
    }

    .departure-row {
      display: flex;
      align-items: center;
      padding: 1.5vh 1vw;
      border-bottom: 0.1vh solid var(--app-kiosk-border-faint);
    }

    .line-badge {
      width: 8vw;
      text-align: center;
      font-size: clamp(3vh, 4vh, 5vh);
      font-weight: 700;
      padding: 1vh 0;
      border-radius: 0.5vh;
      color: var(--app-kiosk-on-surface);
      text-shadow: 0 1px 3px var(--app-kiosk-text-shadow-strong);
      flex-shrink: 0;
    }

    .destination {
      flex: 1;
      font-size: clamp(3vh, 4.5vh, 6vh);
      font-weight: 500;
      padding-left: 2vw;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time-info {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      gap: 1.5vw;
      min-width: 22vw;
      text-align: right;
    }

    .time-relative {
      font-size: clamp(3.5vh, 5vh, 7vh);
      font-weight: 700;
      color: var(--app-kiosk-on-surface);
    }

    /* Imminent: the bus is leaving now. Pop visually so a passenger
       glancing across the platform spots it without parsing every row. */
    .time-relative.imminent {
      color: var(--app-kiosk-info-accent);
      animation: imminentPulse 1.4s ease-in-out infinite;
    }

    @keyframes imminentPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.62; }
    }

    .time-absolute {
      font-size: clamp(2.5vh, 3.5vh, 5vh);
      font-weight: 500;
      font-variant-numeric: tabular-nums;
      color: var(--app-kiosk-on-surface-muted);
    }

    /* --- Departures Viewport (scrolling container) --- */
    .departures-viewport {
      flex: 1;
      overflow: hidden;
      position: relative;
    }

    .departures-track {
      display: flex;
      flex-direction: column;
    }

    .departures-track.scrolling {
      animation: vertical-scroll linear infinite;
    }

    @keyframes vertical-scroll {
      0% { transform: translateY(0); }
      100% { transform: translateY(-50%); }
    }

    .departures-list {
      display: flex;
      flex-direction: column;
    }

    .list-divider {
      height: 0.3vh;
      margin: 2vh 5vw;
      background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.3), transparent);
    }

    .no-departures {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4vh;
      color: var(--app-kiosk-on-surface-muted);
      min-height: 20vh;
    }

    /* --- Info Ticker --- */
    .info-ticker {
      margin-top: auto;
      padding-top: 1.5vh;
      overflow: hidden;
      background: linear-gradient(90deg, var(--app-kiosk-info-bg) 0%, var(--app-kiosk-info-bg-subtle) 50%, var(--app-kiosk-info-bg) 100%);
      border-radius: 0.5vh;
      border-top: 0.3vh solid var(--app-kiosk-info-border);
    }

    .ticker-track {
      display: flex;
      overflow: hidden;
      padding: 1.5vh 0;
      animation: ticker-scroll linear infinite;
      width: max-content;
    }

    .ticker-content {
      display: flex;
      align-items: center;
      white-space: nowrap;
      flex-shrink: 0;
    }

    @keyframes ticker-scroll {
      0% { transform: translateX(0); }
      100% { transform: translateX(-50%); }
    }

    .ticker-item {
      display: inline-flex;
      align-items: center;
      gap: 0.8vw;
      font-size: 3vh;
      color: var(--app-kiosk-info-accent);
    }

    .ticker-warning {
      color: var(--app-kiosk-warning-accent);
    }

    .ticker-item mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
    }

    .ticker-item strong {
      font-weight: 600;
    }

    .ticker-detail {
      margin-left: 0.5vw;
      opacity: 0.85;
    }

    .ticker-separator {
      margin: 0 3vw;
      color: var(--app-kiosk-on-surface-muted);
      font-size: 3vh;
    }

    /* --- Connection Warning (only shown when disconnected) --- */
    .connection-warning {
      position: fixed;
      bottom: 1.5vh;
      right: 2vw;
      display: flex;
      align-items: center;
      gap: 0.8vw;
      background: var(--app-kiosk-connection-error);
      padding: 0.8vh 1.5vw;
      border-radius: 0.5vh;
      font-size: 3vh;
      font-weight: 500;
      /* Calm pulse instead of harsh blink — passengers in a station already
         have enough flicker around them. */
      animation: connectionPulse 2.4s ease-in-out infinite;
    }

    .connection-warning mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
    }

    /* Stale variant — link is up but the server has gone quiet. Less alarming
       than the disconnected state but still flagged so passengers don't
       trust ghost departures. */
    .connection-warning.stale-warning {
      background: var(--app-kiosk-warning-accent);
      color: #1a1a1a;
      animation: none;
    }

    @keyframes connectionPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.78; }
    }

    /* --- Error & Loading States --- */
    .error-state,
    .loading-state {
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
    }

    .error-state mat-icon {
      font-size: 12vh;
      width: 12vh;
      height: 12vh;
      color: var(--app-kiosk-error-icon);
      margin-bottom: 3vh;
    }

    .error-state h1,
    .loading-state h1 {
      font-size: 5vh;
      font-weight: 600;
      margin: 2vh 0;
    }

    .error-state p {
      font-size: 3vh;
      color: var(--app-kiosk-on-surface-muted);
      max-width: 60vw;
    }

    .loading-state mat-spinner {
      margin-bottom: 3vh;
    }

    /* --- Responsive for smaller screens --- */
    @media (max-height: 800px) {
      .stop-name { font-size: 5vh; }
      .clock { font-size: 6vh; }
      .ticker-item { font-size: 3vh; }
      .ticker-item mat-icon { font-size: 3vh; width: 3vh; height: 3vh; }
    }

    /* Portrait mode optimization */
    @media (orientation: portrait) {
      .header { flex-direction: column; align-items: flex-start; gap: 1vh; }
      .clock-container { align-self: flex-end; }
      .clock { font-size: 6vh; }
      .line-badge { width: 12vw; }
      .time-info { min-width: 28vw; }
    }
  `,
})
export class KioskComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly wsService = inject(WebSocketService);

  displayState = signal<DisplayState | null>(null);
  error = signal<string | null>(null);
  currentTime = signal(this.formatTime(new Date()));
  currentDate = signal(this.formatDate(new Date()));

  private token: string | null = null;
  private stopId: string | null = null;
  private deviceId: string | null = null;
  private timeInterval: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
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

  // Whether we need vertical scrolling (more arrivals than fit on screen)
  needsScrolling = computed(() => {
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
    this.route.params.subscribe((params) => {
      const routeStopId = String(params['stopId'] ?? '');
      if (routeStopId) {
        this.stopId = routeStopId;
        this.initializeWithStopId();
      }
    });

    this.route.queryParams.subscribe((params) => {
      this.token = String(params['token'] ?? '') || null;
      const queryStopId = String(params['stopId'] ?? '') || null;

      if (this.token) {
        this.initializeWithToken();
      } else if (queryStopId && !this.stopId) {
        this.stopId = queryStopId;
        this.initializeWithStopId();
      } else if (!this.stopId && !this.token) {
        this.error.set(
          'Missing device token or stop ID. Configure the display URL with /display/:stopId, ?token=<device-token>, or ?stopId=<stop-id>'
        );
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
    if (this.visibilityHandler) {
      document.removeEventListener('visibilitychange', this.visibilityHandler);
      this.visibilityHandler = null;
    }
    this.wsService.disconnect();
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
        this.error.set('Invalid device token or device not found.');
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
        this.error.set('Stop not found.');
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
    this.wsService.reconnected$.subscribe(() => this.refetchSnapshot(stopId));
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

  private refetchSnapshot(stopId: string): void {
    if (this.token) {
      this.displayService.getStateByToken(this.token).subscribe({
        next: (auth) => this.applyState(auth.state),
        error: (err: unknown) => {
          console.error('Failed to refresh snapshot after reconnect:', err);
        },
      });
    } else {
      this.displayService.getState(stopId).subscribe({
        next: (state) => this.applyState(state),
        error: (err: unknown) => {
          console.error('Failed to refresh snapshot after reconnect:', err);
        },
      });
    }
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDate(date: Date): string {
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  }

  formatDepartureTime(time: string): string {
    // Time comes as "HH:MM:SS" or "HH:MM" - show only HH:MM
    const parts = time.split(':');
    return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
  }

  getMinutesUntil(time: string): number {
    // Trigger recalculation when currentTime changes
    this.currentTime();

    const parts = time.split(':');
    const hours = parseInt(parts[0] ?? '0', 10);
    const minutes = parseInt(parts[1] ?? '0', 10);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const departureMinutes = hours * 60 + minutes;

    // Wrap across midnight (same logic as allArrivals filter): a scheduled time
    // earlier than `now` with a large gap means tomorrow's departure.
    let delta = departureMinutes - nowMinutes;
    if (delta < -360) { delta += 1440; }
    return Math.max(0, delta);
  }

  formatRelativeTime(time: string): string {
    const minutes = this.getMinutesUntil(time);
    if (minutes === 0) {
      return 'Imminent';
    }
    return `${minutes} min`;
  }

  /** Whether the next departure is happening now (within the same minute).
   *  Drives the highlighted `.imminent` styling on the relative-time pill. */
  isImminent(time: string): boolean {
    return this.getMinutesUntil(time) === 0;
  }
}
