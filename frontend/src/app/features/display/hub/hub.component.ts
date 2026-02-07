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
import { HubWebSocketService } from '@core/websocket/hub-websocket.service';
import {
  DisplayState,
  HubDisplayState,
  HubArrivalInfo,
  LineInfo,
  MessageInfo,
} from '@shared/models';

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="kiosk">
      @if (hubState()) {
        <!-- Header: Hub name with line badges + Current time -->
        <header class="header">
          <img src="assets/logo.png" alt="" class="header-logo">
          <div class="stop-info">
            <h1 class="stop-name">{{ hubState()!.hubName }}</h1>
            <div class="header-lines">
              @for (line of hubState()!.lines; track line.code) {
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

        <!-- Main departures board (4 columns) -->
        <main class="departures">
          <div class="departures-header">
            <span class="col-line">Line</span>
            <span class="col-platform">Platform</span>
            <span class="col-destination">Destination</span>
            <span class="col-time">Next departure</span>
          </div>
          <div class="departures-viewport">
            <div class="departures-track"
                 [class.scrolling]="needsScrolling()"
                 [style.animationDuration]="scrollDuration()">
              <div class="departures-list">
                @for (arrival of allArrivals(); track (arrival.line.code + '-' + arrival.platform + '-' + arrival.destinationName)) {
                  <div class="departure-row">
                    <span
                      class="line-badge"
                      [style.backgroundColor]="arrival.line.color"
                    >
                      {{ arrival.line.code }}
                    </span>
                    <span class="platform">{{ arrival.platform }}</span>
                    <span class="destination">{{ arrival.destinationName }}</span>
                    <span class="time-info">
                      <span class="time-relative">{{ formatRelativeTime(arrival.scheduledTime) }}</span>
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
                  @for (arrival of allArrivals(); track (arrival.line.code + '-' + arrival.platform + '-' + arrival.destinationName)) {
                    <div class="departure-row">
                      <span
                        class="line-badge"
                        [style.backgroundColor]="arrival.line.color"
                      >
                        {{ arrival.line.code }}
                      </span>
                      <span class="platform">{{ arrival.platform }}</span>
                      <span class="destination">{{ arrival.destinationName }}</span>
                      <span class="time-info">
                        <span class="time-relative">{{ formatRelativeTime(arrival.scheduledTime) }}</span>
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

        <!-- Connection status indicator -->
        @if (!connected()) {
          <div class="connection-warning">
            <mat-icon>wifi_off</mat-icon>
            Reconnecting...
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
       HUB DISPLAY - Multi-stop departure board
       Target: 1920x1080 screens, 3-5m viewing distance
       =========================================== */

    :host {
      display: block;
      background: var(--app-kiosk-surface);
      color: var(--app-kiosk-on-surface);
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

    /* --- Departures Board (4 columns) --- */
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
      width: 7vw;
      text-align: center;
    }

    .col-platform {
      width: 15vw;
      padding-left: 1.5vw;
    }

    .col-destination {
      flex: 1;
      padding-left: 1.5vw;
    }

    .col-time {
      min-width: 20vw;
      text-align: right;
    }

    .departure-row {
      display: flex;
      align-items: center;
      padding: 1.5vh 1vw;
      border-bottom: 0.1vh solid var(--app-kiosk-border-faint);
    }

    .line-badge {
      width: 7vw;
      text-align: center;
      font-size: clamp(3vh, 4vh, 5vh);
      font-weight: 700;
      padding: 1vh 0;
      border-radius: 0.5vh;
      color: var(--app-kiosk-on-surface);
      text-shadow: 0 1px 3px var(--app-kiosk-text-shadow-strong);
      flex-shrink: 0;
    }

    .platform {
      width: 15vw;
      font-size: clamp(2.5vh, 3.5vh, 4.5vh);
      font-weight: 500;
      padding-left: 1.5vw;
      color: var(--app-kiosk-on-surface-muted);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      flex-shrink: 0;
    }

    .destination {
      flex: 1;
      font-size: clamp(3vh, 4.5vh, 6vh);
      font-weight: 500;
      padding-left: 1.5vw;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .time-info {
      display: flex;
      align-items: baseline;
      justify-content: flex-end;
      gap: 1.5vw;
      min-width: 20vw;
      text-align: right;
    }

    .time-relative {
      font-size: clamp(3.5vh, 5vh, 7vh);
      font-weight: 700;
      color: var(--app-kiosk-on-surface);
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

    /* --- Connection Warning --- */
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
      animation: blink 1s ease-in-out infinite;
    }

    .connection-warning mat-icon {
      font-size: 3vh;
      width: 3vh;
      height: 3vh;
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
      .line-badge { width: 10vw; }
      .platform { width: 18vw; }
      .time-info { min-width: 25vw; }
    }
  `,
})
export class HubComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly hubWsService = inject(HubWebSocketService);

  hubState = signal<HubDisplayState | null>(null);
  error = signal<string | null>(null);
  currentTime = signal(this.formatTime(new Date()));
  currentDate = signal(this.formatDate(new Date()));

  private stopIds: string[] = [];
  private hubName = 'Hub';
  private readonly stopStates = new Map<string, DisplayState>();
  private timeInterval: ReturnType<typeof setInterval> | null = null;

  private static readonly MAX_VISIBLE_ARRIVALS = 8;
  private static readonly SECONDS_PER_ARRIVAL = 3;

  allArrivals = computed(() => {
    this.currentTime();

    const arrivals = this.hubState()?.arrivals ?? [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return arrivals.filter(arrival => {
      const parts = arrival.scheduledTime.split(':');
      const arrivalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
      return arrivalMinutes >= currentMinutes;
    });
  });

  needsScrolling = computed(() => {
    const arrivals = this.allArrivals();
    const criticalCount = this.criticalMessages().length;
    const hasInfoMessages = this.infoMessages().length > 0;
    const maxVisible = Math.max(4, Math.min(8, HubComponent.MAX_VISIBLE_ARRIVALS - criticalCount + (hasInfoMessages ? 0 : 1)));
    return arrivals.length > maxVisible;
  });

  scrollDuration = computed(() => {
    const arrivals = this.allArrivals();
    const duration = arrivals.length * HubComponent.SECONDS_PER_ARRIVAL;
    return `${Math.max(10, duration)}s`;
  });

  criticalMessages = computed(() =>
    (this.hubState()?.messages ?? []).filter(m => m.severity === 'CRITICAL')
  );

  infoMessages = computed(() =>
    (this.hubState()?.messages ?? []).filter(m => m.severity !== 'CRITICAL')
  );

  tickerDuration = computed(() => {
    const messages = this.infoMessages();
    const totalLength = messages.reduce((acc, m) =>
      acc + m.title.length + m.content.length, 0
    );
    const duration = Math.max(15, 20 + Math.floor(totalLength / 50) * 2);
    return `${duration}s`;
  });

  alertDuration = computed(() => {
    const messages = this.criticalMessages();
    const totalLength = messages.reduce((acc, m) =>
      acc + m.title.length + m.content.length, 0
    );
    const duration = Math.max(12, 15 + Math.floor(totalLength / 50) * 3);
    return `${duration}s`;
  });

  connected = computed(() => this.hubWsService.isConnected());

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      const stopIdsParam = String(params['stopIds'] ?? '');
      this.hubName = String(params['name'] ?? '') || 'Hub';

      if (!stopIdsParam) {
        this.error.set(
          'Missing stop IDs. Use /hub?stopIds=id1,id2,id3&name=Hub+Name'
        );
        return;
      }

      this.stopIds = stopIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (this.stopIds.length === 0) {
        this.error.set('No valid stop IDs provided.');
        return;
      }

      this.loadInitialState();
    });

    this.timeInterval = setInterval(() => {
      const now = new Date();
      this.currentTime.set(this.formatTime(now));
      this.currentDate.set(this.formatDate(now));
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.timeInterval) {
      clearInterval(this.timeInterval);
    }
    this.hubWsService.disconnect();
  }

  private loadInitialState(): void {
    this.displayService.getHubState(this.stopIds, this.hubName).subscribe({
      next: state => {
        this.hubState.set(state);
        this.subscribeToUpdates();
      },
      error: () => {
        this.error.set('Failed to load hub display state. Check stop IDs.');
      },
    });
  }

  private subscribeToUpdates(): void {
    this.hubWsService.connect(this.stopIds).subscribe({
      next: (state: DisplayState) => {
        this.stopStates.set(state.stopId, state);
        this.rebuildHubState();
      },
      error: err => {
        console.error('Hub WebSocket error:', err);
      },
    });
  }

  private rebuildHubState(): void {
    const states = Array.from(this.stopStates.values());
    if (states.length === 0) { return; }

    // Merge lines, deduplicate by id
    const lineMap = new Map<string, LineInfo>();
    for (const s of states) {
      for (const line of s.lines) {
        if (!lineMap.has(line.id)) {
          lineMap.set(line.id, line);
        }
      }
    }
    const lines = Array.from(lineMap.values()).sort((a, b) => a.code.localeCompare(b.code));

    // Merge arrivals with platform = stopName
    const arrivals: HubArrivalInfo[] = states.flatMap(s =>
      s.arrivals.map(a => ({
        scheduledTime: a.scheduledTime,
        destinationName: a.destinationName,
        platform: s.stopName,
        line: a.line,
      }))
    ).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

    // Deduplicate messages by title+content+severity
    const messageKeys = new Set<string>();
    const messages: MessageInfo[] = [];
    for (const s of states) {
      for (const m of s.messages) {
        const key = `${m.title}|${m.content}|${m.severity}`;
        if (!messageKeys.has(key)) {
          messageKeys.add(key);
          messages.push(m);
        }
      }
    }

    const current = this.hubState();
    this.hubState.set({
      hubName: current?.hubName ?? this.hubName,
      lines,
      arrivals,
      messages: messages.slice(0, 5),
      version: (current?.version ?? 0) + 1,
      generatedAt: new Date().toISOString(),
    });
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
    const parts = time.split(':');
    return `${parts[0] ?? '00'}:${parts[1] ?? '00'}`;
  }

  getMinutesUntil(time: string): number {
    this.currentTime();

    const parts = time.split(':');
    const hours = parseInt(parts[0] ?? '0', 10);
    const minutes = parseInt(parts[1] ?? '0', 10);

    const now = new Date();
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const departureMinutes = hours * 60 + minutes;

    return Math.max(0, departureMinutes - nowMinutes);
  }

  formatRelativeTime(time: string): string {
    const minutes = this.getMinutesUntil(time);
    if (minutes === 0) {
      return 'Imminent';
    }
    return `${minutes} min`;
  }
}
