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
        <!-- Header: Stop name + Current time -->
        <header class="header">
          <div class="stop-info">
            <h1 class="stop-name">{{ displayState()!.stopName }}</h1>
          </div>
          <div class="clock">{{ currentTime() }}</div>
        </header>

        <!-- Critical alerts - full width, impossible to miss -->
        @for (message of criticalMessages(); track $index) {
          <div class="alert-banner">
            <mat-icon>warning</mat-icon>
            <div class="alert-content">
              <strong class="alert-title">{{ message.title }}</strong>
              @if (message.content) {
                <span class="alert-detail">{{ message.content }}</span>
              }
            </div>
          </div>
        }

        <!-- Main departures board -->
        <main class="departures">
          <div class="departures-header">
            <span class="col-line">Line</span>
            <span class="col-destination">Destination</span>
            <span class="col-time">Departure</span>
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
              <span class="time">{{ arrival.scheduledTime }}</span>
            </div>
          } @empty {
            <div class="no-departures">
              No scheduled departures
            </div>
          }
        </main>

        <!-- Info/Warning messages -->
        @if (infoMessages().length > 0) {
          <aside class="info-bar">
            @for (message of infoMessages(); track $index) {
              <div class="info-item" [class.info-warning]="message.severity === 'WARNING'">
                <mat-icon>{{ message.severity === 'WARNING' ? 'warning' : 'info' }}</mat-icon>
                <span class="info-text">
                  <strong>{{ message.title }}</strong>
                  @if (message.content) {
                    — {{ message.content }}
                  }
                </span>
              </div>
            }
          </aside>
        }

        <!-- Footer: Connection status only -->
        <footer class="footer">
          <span class="footer-brand">Transit Display Hub</span>
          <span class="status" [class.status-ok]="connected()" [class.status-error]="!connected()">
            <mat-icon>{{ connected() ? 'wifi' : 'wifi_off' }}</mat-icon>
            {{ connected() ? 'Live' : 'Reconnecting...' }}
          </span>
        </footer>
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
      padding-bottom: 2vh;
      border-bottom: 4px solid rgba(255, 255, 255, 0.3);
      margin-bottom: 1vh;
    }

    .stop-name {
      font-size: 6vh;
      font-weight: 700;
      margin: 0;
      letter-spacing: -0.02em;
    }

    .clock {
      font-size: 8vh;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      letter-spacing: 0.02em;
    }

    /* --- Alert Banner --- */
    .alert-banner {
      display: flex;
      align-items: center;
      gap: 2vw;
      background: #C62828;
      padding: 2vh 2.5vw;
      margin-bottom: 1.5vh;
      border-radius: 0.8vh;
      animation: pulse-alert 2s ease-in-out infinite;
    }

    .alert-banner mat-icon {
      font-size: 5vh;
      width: 5vh;
      height: 5vh;
      flex-shrink: 0;
    }

    .alert-content {
      display: flex;
      flex-direction: column;
      gap: 0.5vh;
    }

    .alert-title {
      font-size: 3.5vh;
      font-weight: 700;
    }

    .alert-detail {
      font-size: 2.8vh;
      opacity: 0.9;
    }

    @keyframes pulse-alert {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.8; }
    }

    /* --- Departures Board --- */
    .departures {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-height: 0;
    }

    .departures-header {
      display: flex;
      align-items: center;
      padding: 1.5vh 1vw;
      font-size: 2.2vh;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.15em;
      color: rgba(255, 255, 255, 0.5);
      border-bottom: 2px solid rgba(255, 255, 255, 0.15);
    }

    .col-line {
      width: 12vw;
      text-align: center;
    }

    .col-destination {
      flex: 1;
    }

    .col-time {
      width: 18vw;
      text-align: right;
    }

    .departure-row {
      display: flex;
      align-items: center;
      padding: 2vh 1vw;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
    }

    .next-departure {
      background: rgba(255, 255, 255, 0.06);
      padding: 3vh 1vw;
    }

    .line-badge {
      width: 10vw;
      text-align: center;
      font-size: 3.5vh;
      font-weight: 700;
      padding: 1vh 0;
      border-radius: 0.6vh;
      color: #fff;
      text-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
      flex-shrink: 0;
    }

    .next-departure .line-badge {
      font-size: 4.5vh;
      padding: 1.5vh 0;
    }

    .destination {
      flex: 1;
      font-size: 4vh;
      font-weight: 500;
      padding-left: 2vw;
    }

    .next-departure .destination {
      font-size: 5vh;
      font-weight: 600;
    }

    .time {
      width: 18vw;
      font-size: 5.5vh;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }

    .next-departure .time {
      font-size: 7vh;
    }

    .no-departures {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 4vh;
      color: rgba(255, 255, 255, 0.4);
    }

    /* --- Info Bar --- */
    .info-bar {
      display: flex;
      flex-direction: column;
      gap: 1vh;
      margin-top: auto;
      padding-top: 1.5vh;
    }

    .info-item {
      display: flex;
      align-items: center;
      gap: 1.5vw;
      background: rgba(33, 150, 243, 0.15);
      padding: 1.5vh 2vw;
      border-radius: 0.6vh;
      border-left: 0.4vw solid #2196F3;
    }

    .info-warning {
      background: rgba(255, 152, 0, 0.15);
      border-left-color: #FF9800;
    }

    .info-item mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
      flex-shrink: 0;
    }

    .info-text {
      font-size: 2.5vh;
      line-height: 1.4;
    }

    .info-text strong {
      font-weight: 600;
    }

    /* --- Footer --- */
    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-top: 1.5vh;
      margin-top: 1.5vh;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }

    .footer-brand {
      font-size: 2vh;
      color: rgba(255, 255, 255, 0.3);
      font-weight: 500;
    }

    .status {
      display: flex;
      align-items: center;
      gap: 0.8vw;
      font-size: 2vh;
      font-weight: 500;
    }

    .status mat-icon {
      font-size: 2.5vh;
      width: 2.5vh;
      height: 2.5vh;
    }

    .status-ok {
      color: #4CAF50;
    }

    .status-error {
      color: #F44336;
      animation: blink 1s ease-in-out infinite;
    }

    @keyframes blink {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
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
      .line-badge { font-size: 3vh; }
      .destination { font-size: 3.5vh; }
      .time { font-size: 4.5vh; }
      .next-departure .line-badge { font-size: 3.5vh; }
      .next-departure .destination { font-size: 4vh; }
      .next-departure .time { font-size: 5.5vh; }
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

  // Limit to 4 arrivals for readability
  displayedArrivals = computed(() =>
    (this.displayState()?.arrivals || []).slice(0, 4)
  );

  criticalMessages = computed(() =>
    (this.displayState()?.messages || []).filter(
      (m) => m.severity === 'CRITICAL'
    )
  );

  infoMessages = computed(() =>
    (this.displayState()?.messages || []).filter(
      (m) => m.severity !== 'CRITICAL'
    )
  );

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
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
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
}
