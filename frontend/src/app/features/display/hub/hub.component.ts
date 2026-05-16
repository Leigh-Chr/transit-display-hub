import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  OnDestroy,
  signal,
  computed,
  inject,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DisplayService } from '@core/api/display.service';
import { HubWebSocketService } from '@core/websocket/hub-websocket.service';
import {
  DisplayState,
  HubDisplayState,
  HubArrivalInfo,
  LineInfo,
  MessageInfo,
} from '@shared/models';
import { lineTextColor } from '@shared/utils/color.utils';
import { LocaleService } from '@core/i18n/locale.service';
import { formatLocaleDate } from '@shared/utils/locale-date.utils';

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [NgOptimizedImage, MatIconModule, MatProgressSpinnerModule, TranslocoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub.component.html',
  styleUrl: './hub.component.scss',
})
export class HubComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly hubWsService = inject(HubWebSocketService);
  private readonly transloco = inject(TranslocoService);
  private readonly localeService = inject(LocaleService);
  private readonly destroyRef = inject(DestroyRef);

  hubState = signal<HubDisplayState | null>(null);
  error = signal<string | null>(null);
  currentTime = signal(this.formatTime(new Date()));
  currentDate = signal(this.formatDate(new Date()));

  // Exposed to the template: prefer the server-resolved foreground color
  // (route_text_color) before falling back to a YIQ-derived contrast.
  readonly lineTextColor = lineTextColor;

  /** ARIA label for the booking badge — screen readers announce
   *  "réservation 0123456789, 30 minutes minimum" rather than just
   *  "phone_callback 0123456789". Mirrors the kiosk implementation. */
  bookingAria(b: { phone: string | null; priorNoticeMinutes: number | null }): string {
    const parts: string[] = [this.transloco.translate('kiosk.booking.aria')];
    if (b.phone) {parts.push(b.phone);}
    if (b.priorNoticeMinutes) {parts.push(`${b.priorNoticeMinutes} minutes minimum`);}
    return parts.join(', ');
  }

  private stopIds: string[] = [];
  private hubName = 'Hub';
  /** Per-stop cached state with the wall-clock timestamp of the last push.
   *  Anything older than STALE_STOP_THRESHOLD_MS is dropped from the rebuild
   *  so a deleted stop (backend stops emitting) doesn't keep showing forever. */
  private readonly stopStates = new Map<string, { state: DisplayState; receivedAt: number }>();
  private timeInterval: ReturnType<typeof setInterval> | null = null;
  private visibilityHandler: (() => void) | null = null;
  /** Wall-clock timestamp of the most recent state update; drives the
   *  stale-data banner when the WS link is up but the backend has gone quiet. */
  lastUpdate = signal<number | null>(null);
  private static readonly STALE_THRESHOLD_MS = 3 * 60 * 1000;
  isStale = computed(() => {
    this.currentTime();
    const last = this.lastUpdate();
    if (last === null) { return false; }
    return Date.now() - last > HubComponent.STALE_THRESHOLD_MS;
  });
  staleMinutes = computed(() => {
    this.currentTime();
    const last = this.lastUpdate();
    if (last === null) { return 0; }
    return Math.floor((Date.now() - last) / 60000);
  });

  private static readonly MAX_VISIBLE_ARRIVALS = 8;
  // Dwell time per visible arrival when the list scrolls. 4s gives readers
  // a comfortable beat to scan multi-platform info.
  private static readonly SECONDS_PER_ARRIVAL = 4;
  /** A stop's cached state goes stale after 30 minutes without a fresh push. */
  private static readonly STALE_STOP_THRESHOLD_MS = 30 * 60 * 1000;

  allArrivals = computed(() => {
    this.currentTime();

    const arrivals = this.hubState()?.arrivals ?? [];
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return arrivals.filter(arrival => {
      const parts = arrival.scheduledTime.split(':');
      const arrivalMinutes = parseInt(parts[0] ?? '0', 10) * 60 + parseInt(parts[1] ?? '0', 10);
      // Wrap arrivals across midnight: a scheduled time earlier than `now` with a
      // large gap (>6h) is tomorrow's arrival (night service into early morning).
      let delta = arrivalMinutes - currentMinutes;
      if (delta < -360) { delta += 1440; }
      return delta >= 0;
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
    // Info ticker: shorter base than before (12s vs 20s) so short messages
    // don't linger forever — content-length scaling still kicks in.
    const duration = Math.max(10, 12 + Math.floor(totalLength / 50) * 2);
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
    this.route.queryParams.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const stopIdsParam = String(params['stopIds'] ?? '');
      this.hubName = String(params['name'] ?? '') || 'Hub';

      if (!stopIdsParam) {
        this.error.set(this.transloco.translate('hub.errors.missingStopIds'));
        return;
      }

      this.stopIds = stopIdsParam.split(',').map(id => id.trim()).filter(Boolean);
      if (this.stopIds.length === 0) {
        this.error.set(this.transloco.translate('hub.errors.noValidStopIds'));
        return;
      }

      this.loadInitialState();
    });

    this.startClock();
    // Pause the clock while the tab is hidden — hubs running 24/7 don't need
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
    this.hubWsService.disconnect();
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

  private loadInitialState(): void {
    this.displayService.getHubState(this.stopIds, this.hubName).subscribe({
      next: state => {
        this.lastUpdate.set(Date.now());
    this.hubState.set(state);
        this.subscribeToUpdates();
      },
      error: () => {
        this.error.set(this.transloco.translate('hub.errors.loadFailed'));
      },
    });
  }

  private subscribeToUpdates(): void {
    this.hubWsService.connect(this.stopIds).subscribe({
      next: (state: DisplayState) => {
        // Drop out-of-order pushes (broker reorder, retried fan-out): only
        // accept a version strictly newer than what we already have for this
        // stopId. Bump receivedAt regardless so we don't show stale.
        const cached = this.stopStates.get(state.stopId);
        if (cached && state.version < cached.state.version) {
          this.stopStates.set(state.stopId, { state: cached.state, receivedAt: Date.now() });
          return;
        }
        this.stopStates.set(state.stopId, { state, receivedAt: Date.now() });
        this.rebuildHubState();
      },
      error: err => {
        console.error('Hub WebSocket error:', err);
      },
    });

    // After a WebSocket interruption, refresh the aggregate snapshot to
    // capture any deletions or renames that happened during the gap. Also
    // wipe stopStates so the version filter can't reject a backend whose
    // in-memory versionMap restarted from scratch.
    this.hubWsService.reconnected$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        this.stopStates.clear();
        this.displayService.getHubState(this.stopIds, this.hubName).subscribe({
        next: state => {
          this.lastUpdate.set(Date.now());
          this.hubState.set(state);
        },
        error: err => {
          console.error('Failed to refresh hub state after reconnect:', err);
        },
      });
    });
  }

  private rebuildHubState(): void {
    const validIds = new Set(this.stopIds);
    const now = Date.now();
    const states: DisplayState[] = [];
    for (const [id, entry] of this.stopStates) {
      if (!validIds.has(id)) {
        // Stop was removed from the hub URL — drop its cached state.
        this.stopStates.delete(id);
        continue;
      }
      if (now - entry.receivedAt > HubComponent.STALE_STOP_THRESHOLD_MS) {
        // No update from this stop for too long — likely deleted upstream.
        // Skip it in the rebuild but keep the entry: a fresh push will revive it.
        continue;
      }
      states.push(entry.state);
    }
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
    this.lastUpdate.set(Date.now());
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
    return formatLocaleDate(date, this.localeService.current(), {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  private formatDate(date: Date): string {
    return formatLocaleDate(date, this.localeService.current(), {
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

    // Wrap across midnight (same logic as allArrivals filter).
    let delta = departureMinutes - nowMinutes;
    if (delta < -360) { delta += 1440; }
    return Math.max(0, delta);
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
    return this.getMinutesUntil(time) === 0;
  }
}
