import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { ActivatedRoute, Params } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DisplayService } from '@core/api/display.service';
import { LocaleService } from '@core/i18n/locale.service';
import { ThemeService } from '@core/services/theme.service';
import { HubWebSocketService } from '@core/websocket/hub-websocket.service';
import { A11yToolbarComponent } from '@shared/components/a11y-toolbar/a11y-toolbar.component';
import { DisplayAlertBannerComponent } from '@shared/components/display-alert-banner/display-alert-banner.component';
import { DisplayInfoTickerComponent } from '@shared/components/display-info-ticker/display-info-ticker.component';
import {
  DisplayState,
  HubArrivalInfo,
  HubDisplayState,
  LineInfo,
  MessageInfo,
} from '@shared/models';
import { lineTextColor } from '@shared/utils/color.utils';
import { formatDepartureTime } from '@shared/utils/time.utils';

import { DisplayDeparturesRowComponent } from '../_shared/display-departures-row/display-departures-row.component';
import { useArrivalsView } from '../_shared/use-arrivals-view';
import { useDisplayClock } from '../_shared/use-display-clock';
import { useMessagesView } from '../_shared/use-messages-view';

/** A stop's cached state goes stale after 30 minutes without a fresh push. */
const STALE_STOP_THRESHOLD_MS = 30 * 60 * 1000;

@Component({
  selector: 'app-hub',
  standalone: true,
  imports: [
    NgOptimizedImage,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslocoPipe,
    A11yToolbarComponent,
    DisplayAlertBannerComponent,
    DisplayInfoTickerComponent,
    DisplayDeparturesRowComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './hub.component.html',
  styleUrl: './hub.component.scss',
})
export class HubComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly hubWsService = inject(HubWebSocketService);
  private readonly transloco = inject(TranslocoService);
  private readonly locale = inject(LocaleService);
  private readonly themeService = inject(ThemeService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly queryParamsSignal = toSignal<Params, Params>(this.route.queryParams, { initialValue: {} });

  hubState = signal<HubDisplayState | null>(null);
  error = signal<string | null>(null);
  /** Stop names that the hub URL asked for but the rebuild could not
   *  surface (no push yet or stale beyond the threshold). Used to render
   *  a non-intrusive banner so passengers and operators understand why
   *  the board has fewer rows than expected. */
  readonly offlineStopNames = signal<string[]>([]);
  /** Tiny longer-living index of {stopId → last known stop name}. We
   *  cannot rely on stopStates for this because a stale entry can be
   *  dropped from the rebuild while still belonging here. */
  private readonly lastKnownStopNames = new Map<string, string>();

  /** Shared 1Hz wall clock — pauses while the tab is hidden, exposes
   *  pre-formatted date/time strings and the isStale helpers. */
  protected readonly clock = useDisplayClock();
  protected readonly currentTime = this.clock.currentTime;
  protected readonly currentDate = this.clock.currentDate;

  // Exposed to the template: prefer the server-resolved foreground color
  // (route_text_color) before falling back to a YIQ-derived contrast.
  readonly lineTextColor = lineTextColor;
  readonly formatDepartureTime = formatDepartureTime;

  private stopIds: string[] = [];
  private hubName = 'Hub';
  /** Per-stop cached state with the wall-clock timestamp of the last push.
   *  Anything older than STALE_STOP_THRESHOLD_MS is dropped from the rebuild
   *  so a deleted stop (backend stops emitting) doesn't keep showing forever. */
  private readonly stopStates = new Map<string, { state: DisplayState; receivedAt: number }>();
  /** Wall-clock timestamp of the most recent state update; drives the
   *  stale-data banner when the WS link is up but the backend has gone quiet. */
  lastUpdate = signal<number | null>(null);
  isStale = computed(() => this.clock.isStale(this.lastUpdate()));
  staleMinutes = computed(() => this.clock.staleMinutes(this.lastUpdate()));

  /** Split of messages into critical / info plus the two scroll-cycle
   *  durations the banner + ticker bind to. */
  private readonly messagesSignal = computed(() => this.hubState()?.messages ?? []);
  protected readonly messagesView = useMessagesView(this.messagesSignal);
  criticalMessages = computed(() => this.messagesView().critical);
  infoMessages = computed(() => this.messagesView().info);
  tickerDuration = computed(() => this.messagesView().tickerDuration);
  alertDuration = computed(() => this.messagesView().alertDuration);

  /** Filter + scroll metrics for the arrivals list. Hub keeps 8 visible
   *  rows by default, dropping to 4 once critical messages steal real
   *  estate (`max-visible - criticalCount + (hasInfoMessages ? 0 : 1)`,
   *  clamped to `[4, 8]`). */
  private readonly arrivalsSignal = computed(() => this.hubState()?.arrivals ?? []);
  private readonly arrivalsConfigSignal = computed(() => ({
    maxVisibleArrivals: 8,
    minVisibleArrivals: 4,
    maxVisibleAfterPenalty: 8,
    criticalMessagesCount: this.criticalMessages().length,
    hasInfoMessages: this.infoMessages().length > 0,
  }));
  protected readonly arrivalsView = useArrivalsView(this.arrivalsSignal, this.clock.now, this.arrivalsConfigSignal);
  allArrivals = computed(() => this.arrivalsView().allArrivals);
  needsScrolling = computed(() => this.arrivalsView().needsScrolling);
  scrollDuration = computed(() => this.arrivalsView().scrollDuration);

  connected = computed(() => this.hubWsService.isConnected());

  constructor() {
    // Query params drive the hub identity (stop IDs, name) and trigger
    // the initial fetch. Using effect + toSignal keeps the wiring inside
    // an injection-aware lifecycle without an explicit subscribe/destroy.
    effect(() => {
      const params = this.queryParamsSignal();
      // Re-run when translations finish loading so the error fallback
      // resolves the actual sentence on first paint instead of leaving
      // the raw "hub.errors.missingStopIds" key on screen.
      this.locale.translationsLoaded();
      // Honour appearance overrides shipped in the hub URL — same pattern
      // as the kiosk so a single deployment URL can preset all settings.
      this.themeService.applyFromQueryParams({
        contrast: paramAsString(params, 'contrast'),
        largeText: paramAsString(params, 'largeText'),
        dark: paramAsString(params, 'dark'),
      });
      const lang = paramAsString(params, 'lang') ?? '';
      if (lang === 'fr' || lang === 'en') {
        this.locale.setLang(lang);
      }
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

    this.destroyRef.onDestroy(() => {
      this.hubWsService.disconnect();
    });
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
    const presentIds = new Set<string>();
    for (const [id, entry] of this.stopStates) {
      if (!validIds.has(id)) {
        // Stop was removed from the hub URL — drop its cached state and
        // forget the last-known name (only used for the offline banner).
        this.stopStates.delete(id);
        this.lastKnownStopNames.delete(id);
        continue;
      }
      // Remember the latest name so the offline banner can show
      // something more useful than the raw id when the stop disappears.
      this.lastKnownStopNames.set(id, entry.state.stopName);
      if (now - entry.receivedAt > STALE_STOP_THRESHOLD_MS) {
        // No update from this stop for too long — likely deleted upstream.
        // Skip it in the rebuild but keep the entry: a fresh push will revive it.
        continue;
      }
      states.push(entry.state);
      presentIds.add(id);
    }
    // Surface every expected stop that didn't make it into the rebuild so
    // a passenger doesn't silently see a shorter board. Falls back to the
    // raw id when no name is known yet (first boot before any push).
    this.offlineStopNames.set(
      this.stopIds
        .filter(id => !presentIds.has(id))
        .map(id => this.lastKnownStopNames.get(id) ?? id)
    );
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

  /** Bound by the retry button on the error state — public so the
   *  template can call it, indirected so tests can stub the reload
   *  without touching {@code window.location} directly. */
  reloadPage(): void {
    window.location.reload();
  }
}

function paramAsString(params: Record<string, unknown>, key: string): string | null {
  const raw = params[key];
  return typeof raw === 'string' ? raw : null;
}
