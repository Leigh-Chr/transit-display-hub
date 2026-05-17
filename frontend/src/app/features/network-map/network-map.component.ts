import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, signal, computed, effect, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgOptimizedImage } from '@angular/common';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { NotifyService } from '@core/services/notify.service';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { linkedQueryParam } from 'ngxtension/linked-query-param';
import { NetworkMapDataService } from './services/network-map-data.service';
import { SchematicLayoutService, LayoutStop } from './services/schematic-layout.service';
import { RouteFinderService, RouteResult } from './services/route-finder.service';
import { SchematicMapComponent } from './components/schematic-map/schematic-map.component';
import { RouteSearchBarComponent } from './components/route-search-bar/route-search-bar.component';
import { LineIndexComponent } from './components/line-index/line-index.component';
import { StopPopupComponent, LineAlertInfo } from './components/stop-popup/stop-popup.component';
import { NetworkMap, NetworkMapAlerts, NetworkMapUpdate } from '@shared/models';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { LocaleService } from '@core/i18n/locale.service';
import { ThemeService } from '@core/services/theme.service';
import { NetworkMapWebSocketService } from '@core/websocket/network-map-websocket.service';
import { FeedCreditsComponent } from '@shared/components/feed-credits/feed-credits.component';
import { LINE_COLOR_FALLBACK } from '@shared/utils/color.utils';

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [
    NgOptimizedImage,
    ReactiveFormsModule,
    RouterLink,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    SchematicMapComponent,
    RouteSearchBarComponent,
    LineIndexComponent,
    FeedCreditsComponent,
    TranslocoPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './network-map.component.html',
  styleUrl: './network-map.component.scss'
})
export class NetworkMapComponent implements OnInit {
  private readonly networkMapService = inject(NetworkMapDataService);
  private readonly layoutService = inject(SchematicLayoutService);
  private readonly routeFinder = inject(RouteFinderService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly notify = inject(NotifyService);
  private readonly transloco = inject(TranslocoService);
  readonly themeService = inject(ThemeService);
  readonly localeService = inject(LocaleService);
  // The subtitle computed reads `locale.current()` to retrigger when
  // the user toggles the language; expose the same instance under a
  // shorter alias to keep the body readable.
  private readonly locale = this.localeService;
  private readonly networkMapWs = inject(NetworkMapWebSocketService);

  private readonly schematicMap = viewChild(SchematicMapComponent);

  loading = signal(true);
  error = signal<string | null>(null);
  networkMap = signal<NetworkMap | null>(null);
  alerts = signal<NetworkMapAlerts>({ networkAlerts: [], lineAlerts: {}, stopAlerts: {} });

  routeResult = signal<RouteResult | null>(null);
  departureStop = signal<LayoutStop | null>(null);
  arrivalStop = signal<LayoutStop | null>(null);
  showFullNetwork = signal(false);
  accessibleOnly = signal(false);

  // Stop search
  stopSearchCtrl = new FormControl<LayoutStop | string>('');
  highlightedStopId = signal<string | null>(null);
  private readonly stopSearchFilter = signal('');
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;
  private searchResetTimer: ReturnType<typeof setTimeout> | null = null;

  filteredStops = computed(() => {
    const term = this.stopSearchFilter();
    if (!term) {return [];}
    const lower = term.toLowerCase();
    return this.layoutStops().filter(s => s.name.toLowerCase().includes(lower));
  });

  subtitle = computed(() => {
    // Reading the active language signal makes the computed re-fire on
    // language switch so the rendered subtitle picks up the new strings.
    this.locale.current();
    const result = this.routeResult();
    if (result) {
      const stops = result.allStopIds.length;
      const stopsLabel = this.transloco.translate(
        stops === 1 ? 'map.route.stopOne' : 'map.route.stopOther',
        { count: stops },
      );
      if (result.transfers === 0) {
        return this.transloco.translate('map.subtitle.directRoute', { stops });
      }
      const transfersKey = result.transfers === 1
        ? 'map.subtitle.transferOne'
        : 'map.subtitle.transferOther';
      return this.transloco.translate(transfersKey, { count: result.transfers })
        + ' — ' + stopsLabel;
    }
    const dep = this.departureStop();
    if (dep && !this.arrivalStop()) {
      return this.transloco.translate('map.subtitle.departure', { name: dep.name });
    }
    return this.transloco.translate('map.subtitle.clickStopHint');
  });

  /** Query param ?lines=M1,T2 — null means "show all" */
  private readonly linesParam = linkedQueryParam('lines', {
    parse: (v: string | null): string[] | null => {
      if (v === null) {return null;}
      if (v === '') {return [];}
      return v.split(',');
    },
    stringify: (v: string[] | null) => v === null ? null : v.join(','),
  });

  /** Query param ?cat=TRAM — null means "all categories" */
  readonly categoryParam = linkedQueryParam('cat');

  /** Trip endpoints. Both must be set to trigger findRoute; clearing
   *  either drops the route. */
  private readonly fromParam = linkedQueryParam('from');
  private readonly toParam = linkedQueryParam('to');

  /** Stop currently being inspected via the popup. Lets the user share
   *  a deep link to "departures from this stop". */
  private readonly stopParam = linkedQueryParam('stop');

  allLines = computed(() => this.networkMap()?.lines ?? []);

  attribution = computed(() => this.networkMap()?.attribution ?? null);

  /** Categories present in the network, ordered by line count desc */
  categories = computed(() => {
    const counts = new Map<string, number>();
    for (const line of this.allLines()) {
      const key = line.category ?? 'Other';
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  });

  /** Currently selected category — null when the param is missing or invalid */
  selectedCategory = computed(() => {
    const param = this.categoryParam();
    if (!param) {return null;}
    return this.categories().some(c => c.key === param) ? param : null;
  });

  /** Lines after applying the category filter (used by the line filter bar) */
  lines = computed(() => {
    const cat = this.selectedCategory();
    if (!cat) {return this.allLines();}
    return this.allLines().filter(l => (l.category ?? 'Other') === cat);
  });

  allLineCodes = computed(() => this.lines().map(l => l.code));

  /** Resolves null (no param) → all codes within the active category */
  private readonly userVisibleLineCodes = computed(() => {
    const valid = new Set(this.allLineCodes());
    const param = this.linesParam();
    if (param === null) {return this.allLineCodes();}
    return param.filter(code => valid.has(code));
  });

  /** Route line codes extracted from the current route result */
  private readonly routeLineCodes = computed(() => {
    const result = this.routeResult();
    if (!result) {return [];}
    return [...new Set(result.segments.map(s => s.lineCode))];
  });

  /** Effective visible codes: auto-filters to route lines when a route is active */
  visibleLineCodes = computed(() => {
    const route = this.routeResult();
    if (route && !this.showFullNetwork()) {
      return this.routeLineCodes();
    }
    return this.userVisibleLineCodes();
  });

  /** Above this many simultaneously visible lines, the schematic stack
   * collapses into an unreadable striped block — fall back to a searchable
   * line index. The user picks a line to enter focus mode. */
  private static readonly INDEX_VIEW_THRESHOLD = 30;

  useIndexView = computed(() =>
    this.visibleLineCodes().length > NetworkMapComponent.INDEX_VIEW_THRESHOLD
  );

  layoutData = computed(() => {
    const map = this.networkMap();
    if (!map) {
      return { stops: [], bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 } };
    }
    // Pass only the category-filtered lines so the layout has exactly N rows for N visible lines
    return this.layoutService.calculateLayout(map.stops, map.bounds, this.lines());
  });

  layoutStops = computed(() => this.layoutData().stops);

  // Use allLines() so colors/ids of interchange lines outside the active
  // category still resolve correctly in popups and badges.
  lineColorMap = computed(() => {
    const map = new Map<string, string>();
    for (const line of this.allLines()) {
      map.set(line.code, line.color);
    }
    return map;
  });

  /** Map line code → line id for reverse lookups */
  private readonly lineIdByCode = computed(() => {
    const map = new Map<string, string>();
    for (const line of this.allLines()) {
      map.set(line.code, line.id);
    }
    return map;
  });

  /** Map stop id → LayoutStop, used to resolve URL params back to stops. */
  private readonly stopById = computed(() => {
    const map = new Map<string, LayoutStop>();
    for (const stop of this.layoutStops()) {
      map.set(stop.id, stop);
    }
    return map;
  });

  /** Tracks which stop's popup is currently mounted so we can detect
   *  no-op URL → state syncs and avoid re-opening the same dialog. */
  private openedStopPopupId: string | null = null;

  constructor() {
    this.stopSearchCtrl.valueChanges.pipe(takeUntilDestroyed()).subscribe(val => {
      if (typeof val === 'string') {
        this.stopSearchFilter.set(val);
      }
    });

    this.destroyRef.onDestroy(() => {
      if (this.highlightTimer) {
        clearTimeout(this.highlightTimer);
      }
      if (this.searchResetTimer) {
        clearTimeout(this.searchResetTimer);
      }
      this.networkMapWs.disconnect();
    });

    // ?from / ?to → restore departure/arrival and trigger findRoute.
    // Runs whenever the URL changes (deep link, back/forward) and
    // whenever stops finish loading. Idempotent: writes only when
    // the resolved stop differs from the current state, which
    // breaks the cycle with the state→URL writes below.
    effect(() => {
      const stopMap = this.stopById();
      if (stopMap.size === 0) {return;}

      const fromId = this.fromParam();
      const toId = this.toParam();
      const wantedDep = fromId !== null ? stopMap.get(fromId) ?? null : null;
      const wantedArr = toId !== null ? stopMap.get(toId) ?? null : null;

      // Drop URL ids that don't match any stop in the current network
      // (renamed/removed stop, wrong feed) instead of leaving the URL
      // in an inconsistent "?from=ghost" state. If this happens while a
      // route was being displayed, the user just lost it silently — surface
      // a snackbar so they understand the network changed under them.
      const droppingDep = fromId !== null && !wantedDep;
      const droppingArr = toId !== null && !wantedArr;
      const hadActiveRoute = this.routeResult() !== null;
      if (droppingDep) {this.fromParam.set(null);}
      if (droppingArr) {this.toParam.set(null);}
      if ((droppingDep || droppingArr) && hadActiveRoute) {
        this.notify.warn(this.transloco.translate('map.routeStaleNotice'));
      }

      const currentDep = this.departureStop();
      const currentArr = this.arrivalStop();
      if (wantedDep?.id !== currentDep?.id) {
        this.departureStop.set(wantedDep);
      }
      if (wantedArr?.id !== currentArr?.id) {
        this.arrivalStop.set(wantedArr);
      }

      // Recompute the route only when both endpoints are present and
      // distinct, and the current routeResult does not already match.
      if (wantedDep && wantedArr && wantedDep.id !== wantedArr.id) {
        const map = this.networkMap();
        if (!map) {return;}
        const result = this.routeResult();
        const matchesCurrent = result !== null
          && result.allStopIds[0] === wantedDep.id
          && result.allStopIds[result.allStopIds.length - 1] === wantedArr.id;
        if (!matchesCurrent) {
          this.routeResult.set(this.routeFinder.findRoute(
              map, wantedDep.id, wantedArr.id,
              {
              accessibleOnly: this.accessibleOnly(),
              pathwayPenaltySeconds: this.accessibleOnly() ? 120 : 0,
            }));
        }
      } else if (this.routeResult() !== null) {
        this.routeResult.set(null);
      }
    });

    // ?stop → open / close the popup for that stop.
    effect(() => {
      const stopMap = this.stopById();
      if (stopMap.size === 0) {return;}
      const stopId = this.stopParam();

      if (stopId === null) {
        if (this.openedStopPopupId !== null) {
          this.stopDialogRef?.close();
        }
        return;
      }

      const stop = stopMap.get(stopId);
      if (!stop) {
        // Unknown id — drop it from the URL so the user can't bookmark a
        // broken link they'd then need to manually clear.
        this.stopParam.set(null);
        return;
      }
      if (this.openedStopPopupId !== stopId) {
        this.openStopPopup(stop);
      }
    });
  }

  ngOnInit(): void {
    this.loadNetwork();
    this.subscribeToUpdates();
  }

  loadNetwork(): void {
    this.loading.set(true);
    this.error.set(null);

    const emptyAlerts: NetworkMapAlerts = { networkAlerts: [], lineAlerts: {}, stopAlerts: {} };

    forkJoin({
      network: this.networkMapService.getNetworkMap(),
      alerts: this.networkMapService.getAlerts().pipe(
        catchError(() => of(emptyAlerts))
      ),
    }).subscribe({
      next: ({ network, alerts }) => {
        this.networkMap.set(network);
        this.alerts.set(alerts);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load network map:', err);
        this.error.set(this.transloco.translate('map.loadFailedSnackbar'));
        this.loading.set(false);
      }
    });
  }

  private subscribeToUpdates(): void {
    this.networkMapWs.connect().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe((update: NetworkMapUpdate) => {
      if (update.type === 'FULL_UPDATE') {
        this.networkMap.set(update.networkMap);
        this.alerts.set(update.alerts);
      } else {
        this.alerts.set(update.alerts);
      }
    });

    // After a WebSocket interruption, the broker may have skipped FULL_UPDATE
    // pushes (e.g. lines or stops were edited during the gap) — re-load the
    // map snapshot so the user doesn't keep an outdated topology on screen.
    this.networkMapWs.reconnected$.pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(() => this.loadNetwork());
  }

  onFilterChange(codes: string[]): void {
    // If user manually changes line filter while route is active,
    // switch to full-network mode to respect their filter
    if (this.routeResult() && !this.showFullNetwork()) {
      this.showFullNetwork.set(true);
    }

    if (codes.length === this.allLineCodes().length) {
      this.linesParam.set(null);
    } else {
      this.linesParam.set(codes);
    }
  }

  toggleNetworkView(): void {
    this.showFullNetwork.update(v => !v);
  }

  setCategory(category: string | null): void {
    // Reset line filter when switching category to avoid lingering invalid codes
    this.linesParam.set(null);
    this.categoryParam.set(category);
    // A computed route may reference lines that the new category filters out,
    // which would render an empty diagram. Clear the route + dep/arr so the
    // user starts a fresh search inside the new category scope.
    if (this.routeResult() !== null || this.departureStop() !== null || this.arrivalStop() !== null) {
      this.onRouteClear();
    }
  }

  /** Focus a single line: set lines param to just this code, keep category if set */
  focusLine(code: string): void {
    this.linesParam.set([code]);
  }

  private stopDialogRef: MatDialogRef<StopPopupComponent> | null = null;

  /** Route search mode: clicking stops selects departure/arrival instead of opening popup */
  private get isRouteSelectionMode(): boolean {
    return this.departureStop() !== null && this.arrivalStop() === null && this.routeResult() === null;
  }

  onStopSelected(stop: LayoutStop): void {
    // Route selection mode: fill arrival
    if (this.isRouteSelectionMode) {
      const departure = this.departureStop();
      if (!departure || stop.id === departure.id) {
        this.openStopPopup(stop);
        return;
      }
      this.arrivalStop.set(stop);
      this.onRouteSearch({ from: departure.id, to: stop.id });
      return;
    }

    // Default: open departure popup
    this.openStopPopup(stop);
  }

  onRouteSearch(event: { from: string; to: string }): void {
    const map = this.networkMap();
    if (!map) {return;}

    const result = this.routeFinder.findRoute(
        map, event.from, event.to,
        {
              accessibleOnly: this.accessibleOnly(),
              pathwayPenaltySeconds: this.accessibleOnly() ? 120 : 0,
            });
    this.routeResult.set(result);
    this.fromParam.set(event.from);
    this.toParam.set(event.to);
  }

  toggleAccessibleOnly(): void {
    this.accessibleOnly.update(v => !v);
    // Re-run the search if a route is currently displayed so the toggle
    // takes effect immediately.
    const route = this.routeResult();
    const map = this.networkMap();
    if (route && map && route.allStopIds.length >= 2) {
      const from = route.allStopIds[0];
      const to = route.allStopIds[route.allStopIds.length - 1];
      if (from && to) {
        this.routeResult.set(this.routeFinder.findRoute(map, from, to,
            {
              accessibleOnly: this.accessibleOnly(),
              pathwayPenaltySeconds: this.accessibleOnly() ? 120 : 0,
            }));
      }
    }
  }

  onRouteClear(): void {
    this.routeResult.set(null);
    this.departureStop.set(null);
    this.arrivalStop.set(null);
    this.showFullNetwork.set(false);
    this.fromParam.set(null);
    this.toParam.set(null);
  }

  onDepartureChanged(stop: LayoutStop | null): void {
    this.departureStop.set(stop);
    this.routeResult.set(null);
    this.showFullNetwork.set(false);
    this.fromParam.set(stop?.id ?? null);
  }

  onArrivalChanged(stop: LayoutStop | null): void {
    this.arrivalStop.set(stop);
    this.routeResult.set(null);
    this.showFullNetwork.set(false);
    this.toParam.set(stop?.id ?? null);
  }

  // --- Stop search ---

  stopDisplayFn = (value: LayoutStop | string): string => {
    if (!value) {return '';}
    if (typeof value === 'string') {return value;}
    return value.name;
  };

  onStopSearchSelected(event: MatAutocompleteSelectedEvent): void {
    const stop = event.option.value as LayoutStop;
    this.stopSearchFilter.set('');

    // Center map and highlight
    this.schematicMap()?.centerOnStop(stop.id);
    this.highlightedStopId.set(stop.id);

    // Clear highlight after a few seconds
    if (this.highlightTimer) {clearTimeout(this.highlightTimer);}
    this.highlightTimer = setTimeout(() => {
      this.highlightedStopId.set(null);
      this.highlightTimer = null;
    }, 3000);

    // Open the popup
    this.openStopPopup(stop);

    // Reset the search field after a tick so the popup gets focus
    if (this.searchResetTimer) {clearTimeout(this.searchResetTimer);}
    this.searchResetTimer = setTimeout(() => {
      this.stopSearchCtrl.setValue('', { emitEvent: false });
      this.stopSearchFilter.set('');
      this.searchResetTimer = null;
    });
  }

  clearStopSearch(): void {
    this.stopSearchCtrl.setValue('', { emitEvent: false });
    this.stopSearchFilter.set('');
    this.highlightedStopId.set(null);
    if (this.highlightTimer) {
      clearTimeout(this.highlightTimer);
      this.highlightTimer = null;
    }
  }

  private openStopPopup(stop: LayoutStop): void {
    if (this.openedStopPopupId === stop.id && this.stopDialogRef) {return;}
    this.stopDialogRef?.close();
    this.openedStopPopupId = stop.id;
    this.stopParam.set(stop.id);

    const origin = this.departureStop();
    this.stopDialogRef = this.dialog.open(StopPopupComponent, {
      data: {
        stop,
        lineColorMap: this.lineColorMap(),
        networkAlerts: this.alerts().networkAlerts,
        stopAlerts: this.alerts().stopAlerts[stop.id] ?? [],
        lineAlerts: this.getLineAlertsForStop(stop),
        originStop: origin && origin.id !== stop.id ? origin : null,
      },
      panelClass: 'dark-theme',
      width: '460px',
      maxWidth: '95vw',
      autoFocus: false,
      ariaLabel: this.transloco.translate('map.stopPopup.ariaDepartures', { stopName: stop.name }),
    });

    this.stopDialogRef.afterClosed().subscribe(() => {
      this.stopDialogRef = null;
      // Only clear the URL if this dialog's stop is still the active
      // one — opening another stop overwrote stopParam already.
      if (this.openedStopPopupId === stop.id) {
        this.openedStopPopupId = null;
        if (this.stopParam() === stop.id) {
          this.stopParam.set(null);
        }
      }
    });
  }

  private getLineAlertsForStop(stop: LayoutStop): LineAlertInfo[] {
    const lineAlerts = this.alerts().lineAlerts;
    const idByCode = this.lineIdByCode();
    const colorMap = this.lineColorMap();
    const result: LineAlertInfo[] = [];

    for (const code of stop.lineCodes) {
      const lineId = idByCode.get(code);
      if (!lineId) {continue;}
      const alerts = lineAlerts[lineId];
      if (!alerts?.length) {continue;}
      const color = colorMap.get(code) ?? LINE_COLOR_FALLBACK;
      for (const a of alerts) {
        result.push({ lineCode: code, lineColor: color, title: a.title, content: a.content, severity: a.severity });
      }
    }

    return result;
  }
}
