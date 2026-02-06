import { Component, DestroyRef, OnInit, signal, computed, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatDialog, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { linkedQueryParam } from 'ngxtension/linked-query-param';
import { NetworkMapDataService } from './services/network-map-data.service';
import { SchematicLayoutService, LayoutStop } from './services/schematic-layout.service';
import { RouteFinderService, RouteResult } from './services/route-finder.service';
import { SchematicMapComponent } from './components/schematic-map/schematic-map.component';
import { RouteSearchBarComponent } from './components/route-search-bar/route-search-bar.component';
import { StopPopupComponent, StopPopupData, LineAlertInfo } from './components/stop-popup/stop-popup.component';
import { NetworkMap, NetworkMapAlerts } from '@shared/models';
import { ThemeService } from '@core/services/theme.service';

@Component({
  selector: 'app-network-map',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    SchematicMapComponent,
    RouteSearchBarComponent,
  ],
  template: `
    <div class="network-map-page">
      <header class="page-header">
        <div class="title-row">
          <mat-icon>map</mat-icon>
          <h1>Network Map</h1>
        </div>
        <p class="subtitle">{{ subtitle() }}</p>
        <button class="theme-toggle" (click)="themeService.toggleTheme()" title="Toggle theme">
          <mat-icon>{{ themeService.isDarkMode() ? 'light_mode' : 'dark_mode' }}</mat-icon>
        </button>
      </header>

      <main class="map-wrapper">
        @if (loading()) {
          <div class="loading-state">
            <mat-spinner diameter="48"></mat-spinner>
            <span>Loading network...</span>
          </div>
        } @else if (error()) {
          <div class="error-state">
            <mat-icon>error_outline</mat-icon>
            <span>{{ error() }}</span>
            <button mat-flat-button (click)="loadNetwork()">Retry</button>
          </div>
        } @else if (layoutStops().length === 0) {
          <div class="empty-state">
            <mat-icon>route</mat-icon>
            <span>No stops configured yet</span>
          </div>
        } @else {
          <app-schematic-map
            [lines]="lines()"
            [stops]="layoutStops()"
            [lineColorMap]="lineColorMap()"
            [visibleLineCodes]="visibleLineCodes()"
            [alerts]="alerts()"
            [routeResult]="routeResult()"
            [departureStopId]="departureStop()?.id ?? null"
            [arrivalStopId]="arrivalStop()?.id ?? null"
            [highlightedStopId]="highlightedStopId()"
            (stopSelected)="onStopSelected($event)"
            (filterChange)="onFilterChange($event)"
          >
            <div class="route-search-overlay">
              <div class="stop-search-panel">
                <div class="panel-header">
                  <mat-icon class="panel-icon">search</mat-icon>
                  <span class="panel-title">Find a stop</span>
                </div>
                <mat-form-field class="stop-search-field" appearance="fill" subscriptSizing="dynamic">
                  <mat-icon matPrefix class="field-icon">location_on</mat-icon>
                  <input matInput
                    [formControl]="stopSearchCtrl"
                    [matAutocomplete]="stopAuto"
                    placeholder="Stop name"
                  />
                  @if (stopSearchCtrl.value) {
                    <button matSuffix class="clear-btn" (click)="clearStopSearch()">
                      <mat-icon>close</mat-icon>
                    </button>
                  }
                  <mat-autocomplete #stopAuto="matAutocomplete"
                    [displayWith]="stopDisplayFn"
                    (optionSelected)="onStopSearchSelected($event)"
                  >
                    @for (stop of filteredStops(); track stop.id) {
                      <mat-option [value]="stop">
                        {{ stop.name }}
                      </mat-option>
                    }
                  </mat-autocomplete>
                </mat-form-field>
              </div>
              <app-route-search-bar
                [stops]="layoutStops()"
                [departureStop]="departureStop()"
                [arrivalStop]="arrivalStop()"
                [routeResult]="routeResult()"
                (search)="onRouteSearch($event)"
                (clear)="onRouteClear()"
                (departureChanged)="onDepartureChanged($event)"
                (arrivalChanged)="onArrivalChanged($event)"
              />
              @if (routeResult()) {
                <button class="view-toggle-btn" (click)="toggleNetworkView()">
                  <mat-icon>{{ showFullNetwork() ? 'filter_alt' : 'public' }}</mat-icon>
                  <span>{{ showFullNetwork() ? 'Route only' : 'Full network' }}</span>
                </button>
              }
            </div>
          </app-schematic-map>
        }
      </main>
    </div>
  `,
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: var(--app-map-surface);
    }

    .network-map-page {
      display: flex;
      flex-direction: column;
      height: 100vh;
      padding: 20px;
      box-sizing: border-box;
    }

    .page-header {
      flex-shrink: 0;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .theme-toggle {
      margin-left: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      padding: 0;
      border: 1px solid var(--app-map-outline);
      border-radius: 50%;
      background: var(--app-map-overlay-bg);
      color: var(--app-map-on-surface-variant);
      cursor: pointer;
      backdrop-filter: blur(8px);
    }

    .theme-toggle:hover {
      background: var(--app-map-surface-container-high);
    }

    .theme-toggle mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .page-header h1 {
      margin: 0;
      font-size: 1.75rem;
      font-weight: 600;
      color: var(--app-map-on-surface);
    }

    .page-header mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: var(--app-map-accent);
    }

    .subtitle {
      margin: 0;
      color: var(--app-map-on-surface-variant);
      font-size: 0.9375rem;
    }

    .map-wrapper {
      flex: 1;
      position: relative;
      min-height: 0;
      border-radius: var(--app-radius-md);
      overflow: hidden;
      box-shadow: 0 4px 20px var(--app-map-shadow);
    }

    .route-search-overlay {
      position: absolute;
      top: 16px;
      right: 16px;
      z-index: 3;
      pointer-events: auto;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      gap: 6px;
      max-height: calc(100% - 32px);
      overflow-y: auto;
    }

    /* --- Stop search panel --- */

    .stop-search-panel {
      width: 230px;
      background: var(--app-map-overlay-bg);
      backdrop-filter: blur(10px);
      border: 1px solid var(--app-map-outline);
      border-radius: var(--app-radius-md);
      padding: 10px 12px;
      box-shadow: 0 4px 16px var(--app-map-shadow);
    }

    .stop-search-panel .panel-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .stop-search-panel .panel-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--app-map-accent);
    }

    .stop-search-panel .panel-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--app-map-on-surface-muted);
      flex: 1;
    }

    .stop-search-field {
      width: 100%;
      --mat-form-field-filled-container-color: var(--app-map-input-bg);
      --mat-form-field-filled-container-shape: 6px;
      --mat-form-field-container-height: 40px;
      --mat-form-field-container-vertical-padding: 8px;
      --mat-form-field-container-text-size: 13px;
      --mat-form-field-filled-input-text-color: var(--app-map-on-surface);
      --mat-form-field-filled-input-text-placeholder-color: var(--app-map-input-placeholder);
      --mat-form-field-filled-active-indicator-height: 0;
      --mat-form-field-filled-focus-active-indicator-height: 0;
      --mat-form-field-focus-state-layer-opacity: 0;
      --mat-form-field-hover-state-layer-opacity: 0.03;
    }

    .stop-search-panel .field-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 2px;
      color: var(--app-map-accent);
    }

    .stop-search-panel .clear-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: 1px solid var(--app-map-outline);
      border-radius: 50%;
      background: var(--app-map-surface-container-high);
      color: var(--app-map-on-surface-muted);
      cursor: pointer;
    }

    .stop-search-panel .clear-btn:hover {
      background: var(--app-map-surface-container-higher);
    }

    .stop-search-panel .clear-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    @media (max-width: 600px) {
      .stop-search-panel {
        width: 190px;
        padding: 8px 10px;
      }
    }

    .view-toggle-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      padding: 6px 12px;
      background: var(--app-map-overlay-bg);
      backdrop-filter: blur(10px);
      border: 1px solid var(--app-map-outline);
      border-radius: var(--app-radius-sm);
      color: var(--app-map-on-surface-variant);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
      box-shadow: 0 2px 8px var(--app-map-shadow);
    }

    .view-toggle-btn:hover {
      background: var(--app-map-surface-container-high);
    }

    .view-toggle-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    .loading-state,
    .error-state,
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 16px;
      color: var(--app-map-on-surface-variant);
      background: linear-gradient(135deg, var(--app-map-surface-variant) 0%, var(--app-map-surface-container) 100%);
    }

    .error-state {
      color: var(--app-critical);
    }

    .error-state mat-icon,
    .empty-state mat-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
    }

    .error-state [mat-flat-button] {
      margin-top: 8px;
    }

    @media (max-width: 600px) {
      .network-map-page {
        padding: 12px;
      }

      .page-header {
        flex-direction: column;
        align-items: flex-start;
      }

      .page-header h1 {
        font-size: 1.5rem;
      }
    }
  `
})
export class NetworkMapComponent implements OnInit {
  private readonly networkMapService = inject(NetworkMapDataService);
  private readonly layoutService = inject(SchematicLayoutService);
  private readonly routeFinder = inject(RouteFinderService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  readonly themeService = inject(ThemeService);

  private schematicMap = viewChild(SchematicMapComponent);

  loading = signal(true);
  error = signal<string | null>(null);
  networkMap = signal<NetworkMap | null>(null);
  alerts = signal<NetworkMapAlerts>({ networkAlerts: [], lineAlerts: {}, stopAlerts: {} });

  routeResult = signal<RouteResult | null>(null);
  departureStop = signal<LayoutStop | null>(null);
  arrivalStop = signal<LayoutStop | null>(null);
  showFullNetwork = signal(false);

  // Stop search
  stopSearchCtrl = new FormControl<LayoutStop | string>('');
  highlightedStopId = signal<string | null>(null);
  private stopSearchFilter = signal('');
  private highlightTimer: ReturnType<typeof setTimeout> | null = null;

  filteredStops = computed(() => {
    const term = this.stopSearchFilter();
    if (!term) return [];
    const lower = term.toLowerCase();
    return this.layoutStops().filter(s => s.name.toLowerCase().includes(lower));
  });

  subtitle = computed(() => {
    const result = this.routeResult();
    if (result) {
      const transfers = result.transfers;
      return transfers === 0
        ? `Direct route — ${result.allStopIds.length} stops`
        : `${transfers} transfer${transfers > 1 ? 's' : ''} — ${result.allStopIds.length} stops`;
    }
    const dep = this.departureStop();
    if (dep && !this.arrivalStop()) {
      return `Departure: ${dep.name} — select an arrival stop`;
    }
    return 'Click on a stop to see upcoming departures';
  });

  /** Query param ?lines=M1,T2 — null means "show all" */
  private linesParam = linkedQueryParam('lines', {
    parse: (v: string | null): string[] | null => {
      if (v === null) return null;
      if (v === '') return [];
      return v.split(',');
    },
    stringify: (v: string[] | null) => v === null ? null : v.join(','),
  });

  lines = computed(() => this.networkMap()?.lines ?? []);

  allLineCodes = computed(() => this.lines().map(l => l.code));

  /** Resolves null (no param) → all codes; filters out invalid codes */
  private userVisibleLineCodes = computed(() => {
    const param = this.linesParam();
    if (param === null) return this.allLineCodes();
    const valid = new Set(this.allLineCodes());
    return param.filter(code => valid.has(code));
  });

  /** Route line codes extracted from the current route result */
  private routeLineCodes = computed(() => {
    const result = this.routeResult();
    if (!result) return [];
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

  layoutData = computed(() => {
    const map = this.networkMap();
    if (!map) {
      return { stops: [], bounds: { minX: 0, minY: 0, maxX: 1000, maxY: 1000, width: 1000, height: 1000 } };
    }
    return this.layoutService.calculateLayout(map.stops, map.bounds, map.lines);
  });

  layoutStops = computed(() => this.layoutData().stops);

  lineColorMap = computed(() => {
    const map = new Map<string, string>();
    for (const line of this.lines()) {
      map.set(line.code, line.color);
    }
    return map;
  });

  /** Map line code → line id for reverse lookups */
  private lineIdByCode = computed(() => {
    const map = new Map<string, string>();
    for (const line of this.lines()) {
      map.set(line.code, line.id);
    }
    return map;
  });

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
    });
  }

  ngOnInit(): void {
    this.loadNetwork();
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
        this.error.set('Failed to load network map. Please try again.');
        this.loading.set(false);
      }
    });
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

  private stopDialogRef: MatDialogRef<StopPopupComponent> | null = null;

  /** Route search mode: clicking stops selects departure/arrival instead of opening popup */
  private get isRouteSelectionMode(): boolean {
    return this.departureStop() !== null && this.arrivalStop() === null && this.routeResult() === null;
  }

  onStopSelected(stop: LayoutStop): void {
    // Route selection mode: fill arrival
    if (this.isRouteSelectionMode) {
      if (stop.id === this.departureStop()!.id) {
        this.openStopPopup(stop);
        return;
      }
      this.arrivalStop.set(stop);
      this.onRouteSearch({ from: this.departureStop()!.id, to: stop.id });
      return;
    }

    // Default: open departure popup
    this.openStopPopup(stop);
  }

  onRouteSearch(event: { from: string; to: string }): void {
    const map = this.networkMap();
    if (!map) return;

    const result = this.routeFinder.findRoute(map, event.from, event.to);
    this.routeResult.set(result);
  }

  onRouteClear(): void {
    this.routeResult.set(null);
    this.departureStop.set(null);
    this.arrivalStop.set(null);
    this.showFullNetwork.set(false);
  }

  onDepartureChanged(stop: LayoutStop | null): void {
    this.departureStop.set(stop);
    this.routeResult.set(null);
    this.showFullNetwork.set(false);
  }

  onArrivalChanged(stop: LayoutStop | null): void {
    this.arrivalStop.set(stop);
    this.routeResult.set(null);
    this.showFullNetwork.set(false);
  }

  // --- Stop search ---

  stopDisplayFn = (value: LayoutStop | string): string => {
    if (!value) return '';
    if (typeof value === 'string') return value;
    return value.name;
  };

  onStopSearchSelected(event: MatAutocompleteSelectedEvent): void {
    const stop = event.option.value as LayoutStop;
    this.stopSearchFilter.set('');

    // Center map and highlight
    this.schematicMap()?.centerOnStop(stop.id);
    this.highlightedStopId.set(stop.id);

    // Clear highlight after a few seconds
    if (this.highlightTimer) clearTimeout(this.highlightTimer);
    this.highlightTimer = setTimeout(() => {
      this.highlightedStopId.set(null);
      this.highlightTimer = null;
    }, 3000);

    // Open the popup
    this.openStopPopup(stop);

    // Reset the search field after a tick so the popup gets focus
    setTimeout(() => {
      this.stopSearchCtrl.setValue('', { emitEvent: false });
      this.stopSearchFilter.set('');
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
    this.stopDialogRef?.close();

    this.stopDialogRef = this.dialog.open(StopPopupComponent, {
      data: {
        stop,
        lineColorMap: this.lineColorMap(),
        networkAlerts: this.alerts().networkAlerts,
        stopAlerts: this.alerts().stopAlerts[stop.id] ?? [],
        lineAlerts: this.getLineAlertsForStop(stop),
      } as StopPopupData,
      panelClass: 'dark-theme',
      width: '460px',
      maxWidth: '95vw',
      autoFocus: false,
      ariaLabel: `Departures from ${stop.name}`,
    });

    this.stopDialogRef.afterClosed().subscribe(() => {
      this.stopDialogRef = null;
    });
  }

  private getLineAlertsForStop(stop: LayoutStop): LineAlertInfo[] {
    const lineAlerts = this.alerts().lineAlerts;
    const idByCode = this.lineIdByCode();
    const colorMap = this.lineColorMap();
    const result: LineAlertInfo[] = [];

    for (const code of stop.lineCodes) {
      const lineId = idByCode.get(code);
      if (!lineId) continue;
      const alerts = lineAlerts[lineId];
      if (!alerts?.length) continue;
      const color = colorMap.get(code) ?? '#666';
      for (const a of alerts) {
        result.push({ lineCode: code, lineColor: color, title: a.title, content: a.content, severity: a.severity });
      }
    }

    return result;
  }
}
