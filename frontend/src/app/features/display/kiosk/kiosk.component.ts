import { Component, OnInit, OnDestroy, signal, computed, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { DisplayService } from '@core/api/display.service';
import { WebSocketService, ConnectionState } from '@core/websocket/websocket.service';
import { DisplayState } from '@shared/models';

@Component({
  selector: 'app-kiosk',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-neutral-900 text-white p-8 flex flex-col">
      @if (displayState()) {
        <!-- Header -->
        <header class="mb-8">
          <div class="flex items-center gap-4 mb-2">
            <div
              class="w-16 h-16 rounded-lg flex items-center justify-center text-2xl font-bold"
              [style.backgroundColor]="displayState()!.line.color">
              {{ displayState()!.line.code }}
            </div>
            <div>
              <h1 class="text-4xl font-bold">{{ displayState()!.stopName }}</h1>
              <p class="text-neutral-400 text-lg">{{ displayState()!.line.name }}</p>
            </div>
          </div>
        </header>

        <!-- Critical Messages Banner -->
        @if (criticalMessages().length > 0) {
          <div class="bg-red-600 rounded-lg p-4 mb-6 animate-pulse">
            @for (message of criticalMessages(); track $index) {
              <div class="flex items-center gap-3">
                <span class="text-2xl">!</span>
                <div>
                  <div class="font-bold text-lg">{{ message.title }}</div>
                  <div>{{ message.content }}</div>
                </div>
              </div>
            }
          </div>
        }

        <!-- Main Content -->
        <div class="flex-1 flex gap-8">
          <!-- Arrivals Board -->
          <div class="flex-1">
            <h2 class="text-xl font-semibold text-neutral-400 mb-4">NEXT DEPARTURES</h2>
            <div class="space-y-3">
              @for (arrival of arrivals(); track $index; let i = $index) {
                <div
                  class="bg-neutral-800 rounded-lg p-4 flex items-center"
                  [class.border-l-4]="i === 0"
                  [style.border-left-color]="i === 0 ? displayState()!.line.color : 'transparent'">
                  <div class="flex-1">
                    <div class="text-2xl font-bold">{{ arrival.destinationName }}</div>
                  </div>
                  <div class="text-right">
                    <div class="text-4xl font-mono font-bold">
                      {{ arrival.scheduledTime }}
                    </div>
                  </div>
                </div>
              } @empty {
                <div class="bg-neutral-800 rounded-lg p-8 text-center text-neutral-500">
                  No upcoming departures
                </div>
              }
            </div>
          </div>

          <!-- Messages Panel -->
          @if (infoMessages().length > 0) {
            <div class="w-96">
              <h2 class="text-xl font-semibold text-neutral-400 mb-4">SERVICE INFORMATION</h2>
              <div class="space-y-3">
                @for (message of infoMessages(); track $index) {
                  <div
                    class="rounded-lg p-4 border-l-4"
                    [ngClass]="{
                      'bg-orange-900 bg-opacity-50 border-orange-500': message.severity === 'WARNING',
                      'bg-blue-900 bg-opacity-50 border-blue-500': message.severity === 'INFO'
                    }">
                    <div class="font-semibold mb-1">{{ message.title }}</div>
                    <div class="text-sm text-neutral-300">{{ message.content }}</div>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Footer -->
        <footer class="mt-8 pt-4 border-t border-neutral-800 flex justify-between text-neutral-500 text-sm">
          <div>{{ currentTime() }}</div>
          <div>
            @if (connected()) {
              <span class="text-green-500">Connected</span>
            } @else {
              <span class="text-red-500">Disconnected - Reconnecting...</span>
            }
          </div>
        </footer>
      } @else if (error()) {
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-6xl mb-4">!</div>
            <h1 class="text-2xl font-bold mb-2">Display Error</h1>
            <p class="text-neutral-400">{{ error() }}</p>
          </div>
        </div>
      } @else {
        <div class="flex-1 flex items-center justify-center">
          <div class="text-center">
            <div class="text-6xl mb-4">...</div>
            <h1 class="text-2xl font-bold">Loading Display...</h1>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class KioskComponent implements OnInit, OnDestroy {
  displayState = signal<DisplayState | null>(null);
  error = signal<string | null>(null);
  currentTime = signal(this.formatTime(new Date()));

  private token: string | null = null;
  private stopId: string | null = null;
  private timeInterval: ReturnType<typeof setInterval> | null = null;

  arrivals = computed(() => this.displayState()?.arrivals || []);

  criticalMessages = computed(() =>
    (this.displayState()?.messages || []).filter(m => m.severity === 'CRITICAL')
  );

  infoMessages = computed(() =>
    (this.displayState()?.messages || []).filter(m => m.severity !== 'CRITICAL')
  );

  connected = computed(() => this.wsService.connectionState() === 'CONNECTED');

  constructor(
    private route: ActivatedRoute,
    private displayService: DisplayService,
    private wsService: WebSocketService
  ) {}

  ngOnInit(): void {
    // Check route params first (for /display/:stopId)
    this.route.params.subscribe(params => {
      const routeStopId = params['stopId'];
      if (routeStopId) {
        this.stopId = routeStopId;
        this.initializeWithStopId();
      }
    });

    // Check query params (for /display?token=xxx or /display?stopId=xxx)
    this.route.queryParams.subscribe(params => {
      this.token = params['token'] || null;
      const queryStopId = params['stopId'] || null;

      if (this.token) {
        this.initializeWithToken();
      } else if (queryStopId && !this.stopId) {
        this.stopId = queryStopId;
        this.initializeWithStopId();
      } else if (!this.stopId && !this.token) {
        this.error.set('Missing device token or stop ID. Configure the display URL with /display/:stopId, ?token=<device-token>, or ?stopId=<stop-id>');
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
      }
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
      }
    });
  }

  private subscribeToUpdates(stopId: string): void {
    this.wsService.connect(stopId).subscribe({
      next: (state) => {
        this.displayState.set(state);
      },
      error: (err) => {
        console.error('WebSocket error:', err);
      }
    });
  }

  private formatTime(date: Date): string {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}
