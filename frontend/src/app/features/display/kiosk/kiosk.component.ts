import {
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
  template: `
    <div class="kiosk">
      @if (displayState()) {
        <!-- Header: Stop name with line badges + Current time -->
        <header class="header">
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
          <div class="clock">{{ currentTime() }}</div>
        </header>

        <!-- Critical alert (single banner, rotates if multiple) -->
        @if (currentCriticalMessage(); as message) {
          <div class="alert-banner">
            <mat-icon>warning</mat-icon>
            <span class="alert-text">
              <strong>{{ message.title }}</strong>
              @if (message.content) {
                <span class="alert-detail">— {{ message.content }}</span>
              }
            </span>
            @if (criticalMessages().length > 1) {
              <span class="alert-counter">
                {{ (currentAlertIndex() % criticalMessages().length) + 1 }}/{{ criticalMessages().length }}
              </span>
            }
          </div>
        }

        <!-- Main departures board -->
        <main class="departures">
          <div class="departures-header">
            <span class="col-line">Ligne</span>
            <span class="col-destination">Destination</span>
            <span class="col-time">Départ</span>
          </div>
          @for (arrival of displayedArrivals(); track $index; let i = $index) {
              <div class="departure-row" [class.next-departure]="i === 0">
                <span
                  class="line-badge"
                  [style.backgroundColor]="arrival.line.color"
                >
                  {{ arrival.line.code }}
                </span>
                <span class="destination">{{ arrival.destinationName }}</span>
                <span class="time">{{ formatDepartureTime(arrival.scheduledTime) }}</span>
              </div>
            } @empty {
              <div class="no-departures">
                No scheduled departures
              </div>
            }
        </main>

        <!-- Info/Warning messages ticker -->
        @if (infoMessages().length > 0) {
          <aside class="info-ticker">
            <div class="ticker-track">
              <div class="ticker-content" [style.animationDuration]="tickerDuration()">
                <span class="ticker-spacer"></span>
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
                <!-- Duplicate for seamless loop -->
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
          <div class="connection-warning">
            <mat-icon>wifi_off</mat-icon>
            Reconnexion...
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
          <mat-spinner diameter="80"></mat-spinner>
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
      background: #000;
      color: #fff;
      min-height: 100vh;
      font-family: 'Roboto', 'Arial', sans-serif;
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
      border-bottom: 3px solid rgba(255, 255, 255, 0.25);
      margin-bottom: 1.5vh;
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
      border-radius: 0.4vh;
      font-size: 2.5vh;
      font-weight: 700;
      color: #fff;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
    }

    .clock {
      font-size: 8vh;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }

    /* --- Alert Banner (compact) --- */
    .alert-banner {
      display: flex;
      align-items: center;
      gap: 1.5vw;
      background: #C62828;
      padding: 1.2vh 2vw;
      margin-bottom: 1vh;
      border-radius: 0.5vh;
      animation: pulse-alert 2s ease-in-out infinite;
    }

    .alert-banner mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
      flex-shrink: 0;
    }

    .alert-text {
      font-size: 3vh;
      line-height: 1.3;
    }

    .alert-text strong {
      font-weight: 700;
    }

    .alert-detail {
      opacity: 0.9;
      margin-left: 0.5vw;
    }

    .alert-counter {
      margin-left: auto;
      padding: 0.3vh 0.8vw;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 0.4vh;
      font-size: 2.5vh;
      font-weight: 600;
      flex-shrink: 0;
    }

    @keyframes pulse-alert {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.85; }
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
      font-size: 2.5vh;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.1em;
      color: rgba(255, 255, 255, 0.4);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
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
      width: 16vw;
      text-align: right;
    }

    .departure-row {
      display: flex;
      align-items: center;
      padding: 0 1vw;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      flex: 1;
      min-height: 0;
    }

    .next-departure {
      background: rgba(255, 255, 255, 0.06);
      flex: 1.5;
    }

    .line-badge {
      width: 8vw;
      text-align: center;
      font-size: clamp(2.5vh, 4vh, 5vh);
      font-weight: 700;
      padding: 1vh 0;
      border-radius: 0.6vh;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      flex-shrink: 0;
    }

    .next-departure .line-badge {
      font-size: clamp(3vh, 5vh, 6vh);
      padding: 1.2vh 0;
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

    .next-departure .destination {
      font-size: clamp(3.5vh, 5.5vh, 7vh);
      font-weight: 600;
    }

    .time {
      width: 16vw;
      font-size: clamp(4vh, 6vh, 8vh);
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .next-departure .time {
      font-size: clamp(5vh, 7.5vh, 10vh);
    }

    .no-departures {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4vh;
      color: rgba(255, 255, 255, 0.4);
    }

    /* --- Info Ticker --- */
    .info-ticker {
      margin-top: auto;
      padding-top: 1.5vh;
      overflow: hidden;
      background: linear-gradient(90deg, rgba(33, 150, 243, 0.1) 0%, rgba(33, 150, 243, 0.05) 50%, rgba(33, 150, 243, 0.1) 100%);
      border-radius: 0.6vh;
      border-top: 2px solid rgba(33, 150, 243, 0.3);
    }

    .ticker-track {
      overflow: hidden;
      padding: 1.5vh 0;
    }

    .ticker-content {
      display: flex;
      align-items: center;
      white-space: nowrap;
      animation: ticker-scroll linear infinite;
      width: max-content;
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
      color: #64B5F6;
    }

    .ticker-warning {
      color: #FFB74D;
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
      color: rgba(255, 255, 255, 0.3);
      font-size: 2.5vh;
    }

    .ticker-spacer {
      display: inline-block;
      width: 100vw;
    }

    /* --- Connection Warning (only shown when disconnected) --- */
    .connection-warning {
      position: fixed;
      bottom: 1.5vh;
      right: 2vw;
      display: flex;
      align-items: center;
      gap: 0.8vw;
      background: rgba(244, 67, 54, 0.9);
      padding: 0.8vh 1.5vw;
      border-radius: 0.5vh;
      font-size: 2.5vh;
      font-weight: 500;
      animation: blink 1s ease-in-out infinite;
    }

    .connection-warning mat-icon {
      font-size: 2.5vh;
      width: 2.5vh;
      height: 2.5vh;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.5; }
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
      color: #F44336;
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
      color: rgba(255, 255, 255, 0.6);
      max-width: 60vw;
    }

    .loading-state mat-spinner {
      margin-bottom: 3vh;
    }

    /* --- Responsive for smaller screens --- */
    @media (max-height: 800px) {
      .stop-name { font-size: 5vh; }
      .clock { font-size: 6vh; }
      .ticker-item { font-size: 2.5vh; }
      .ticker-item mat-icon { font-size: 2.5vh; width: 2.5vh; height: 2.5vh; }
    }

    /* Portrait mode optimization */
    @media (orientation: portrait) {
      .header { flex-direction: column; align-items: flex-start; gap: 1vh; }
      .clock { align-self: flex-end; font-size: 6vh; }
      .line-badge { width: 12vw; }
      .time { width: 22vw; }
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

  private token: string | null = null;
  private stopId: string | null = null;
  private timeInterval: ReturnType<typeof setInterval> | null = null;
  private alertRotationInterval: ReturnType<typeof setInterval> | null = null;

  // Current critical alert index for rotation
  currentAlertIndex = signal(0);

  // Dynamic arrivals count based on available space (more if no critical messages)
  maxArrivals = computed(() => {
    const criticalCount = this.criticalMessages().length;
    const hasInfoMessages = this.infoMessages().length > 0;
    // Base: 5 arrivals, reduce by 1 for each critical message, add 1 if no info ticker
    return Math.max(3, Math.min(6, 5 - criticalCount + (hasInfoMessages ? 0 : 1)));
  });

  displayedArrivals = computed(() =>
    (this.displayState()?.arrivals || []).slice(0, this.maxArrivals())
  );

  criticalMessages = computed(() =>
    (this.displayState()?.messages || []).filter(
      (m) => m.severity === 'CRITICAL'
    )
  );

  // Current critical message to display (rotates if multiple)
  currentCriticalMessage = computed(() => {
    const messages = this.criticalMessages();
    if (messages.length === 0) return null;
    const index = this.currentAlertIndex() % messages.length;
    return messages[index];
  });

  infoMessages = computed(() =>
    (this.displayState()?.messages || []).filter(
      (m) => m.severity !== 'CRITICAL'
    )
  );

  // Calculate ticker scroll duration based on content length (slower = more readable)
  tickerDuration = computed(() => {
    const messages = this.infoMessages();
    const totalLength = messages.reduce((acc, m) =>
      acc + (m.title?.length || 0) + (m.content?.length || 0), 0
    );
    // Base: 20s, add 2s per 50 characters for readability
    const duration = Math.max(15, 20 + Math.floor(totalLength / 50) * 2);
    return `${duration}s`;
  });

  connected = computed(
    () => this.wsService.connectionState() === 'CONNECTED'
  );

  ngOnInit(): void {
    this.route.params.subscribe((params) => {
      const routeStopId = params['stopId'];
      if (routeStopId) {
        this.stopId = routeStopId;
        this.initializeWithStopId();
      }
    });

    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || null;
      const queryStopId = params['stopId'] || null;

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

    this.timeInterval = setInterval(() => {
      this.currentTime.set(this.formatTime(new Date()));
    }, 1000);

    // Rotate critical alerts every 5 seconds
    this.alertRotationInterval = setInterval(() => {
      const count = this.criticalMessages().length;
      if (count > 1) {
        this.currentAlertIndex.update(i => (i + 1) % count);
      }
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
    if (this.alertRotationInterval) {
      clearInterval(this.alertRotationInterval);
    }
    this.wsService.disconnect();
  }

  private initializeWithToken(): void {
    this.displayService.getStateByToken(this.token!).subscribe({
      next: (state) => {
        this.displayState.set(state);
        this.subscribeToUpdates(state.stopId);
      },
      error: () => {
        this.error.set('Invalid device token or device not found.');
      },
    });
  }

  private initializeWithStopId(): void {
    this.displayService.getState(this.stopId!).subscribe({
      next: (state) => {
        this.displayState.set(state);
        this.subscribeToUpdates(this.stopId!);
      },
      error: () => {
        this.error.set('Stop not found.');
      },
    });
  }

  private subscribeToUpdates(stopId: string): void {
    this.wsService.connect(stopId).subscribe({
      next: (state) => {
        this.displayState.set(state);
      },
      error: (err) => {
        console.error('WebSocket error:', err);
      },
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  formatDepartureTime(time: string): string {
    // Time comes as "HH:MM:SS" or "HH:MM" - show only HH:MM
    const parts = time.split(':');
    return `${parts[0]}:${parts[1]}`;
  }
}
