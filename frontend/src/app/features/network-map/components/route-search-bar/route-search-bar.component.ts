import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  effect,
  computed,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { LayoutStop } from '../../services/schematic-layout.service';
import { RouteResult } from '../../services/route-finder.service';

@Component({
  selector: 'app-route-search-bar',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="route-search-panel">
      <div class="panel-header">
        <mat-icon class="panel-icon">route</mat-icon>
        <span class="panel-title">Route</span>
        @if (selectedDeparture() || selectedArrival()) {
          <button class="clear-btn" (click)="clearSearch()" title="Clear search">
            <mat-icon>close</mat-icon>
          </button>
        }
      </div>

      <mat-form-field class="search-field" appearance="fill" subscriptSizing="dynamic">
        <mat-icon matPrefix class="field-icon departure-icon">trip_origin</mat-icon>
        <input matInput
          [formControl]="departureCtrl"
          [matAutocomplete]="depAuto"
          placeholder="Departure"
        />
        <mat-autocomplete #depAuto="matAutocomplete"
          [displayWith]="displayFn"
          (optionSelected)="onDepartureSelected($event)"
        >
          @for (stop of filteredDepartures(); track stop.id) {
            <mat-option [value]="stop">
              {{ stop.name }}
            </mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>

      <div class="field-separator">
        <span class="connector-line"></span>
        <button class="swap-btn" (click)="swapStops()" title="Swap">
          <mat-icon>swap_vert</mat-icon>
        </button>
        <span class="connector-line"></span>
      </div>

      <mat-form-field class="search-field" appearance="fill" subscriptSizing="dynamic">
        <mat-icon matPrefix class="field-icon arrival-icon">place</mat-icon>
        <input matInput
          [formControl]="arrivalCtrl"
          [matAutocomplete]="arrAuto"
          placeholder="Arrival"
        />
        <mat-autocomplete #arrAuto="matAutocomplete"
          [displayWith]="displayFn"
          (optionSelected)="onArrivalSelected($event)"
        >
          @for (stop of filteredArrivals(); track stop.id) {
            <mat-option [value]="stop">
              {{ stop.name }}
            </mat-option>
          }
        </mat-autocomplete>
      </mat-form-field>

      @if (sameStopError()) {
        <div class="error-hint">Same stop selected</div>
      }

      @if (routeResult(); as route) {
        <div class="route-breakdown">
          @for (segment of route.segments; track $index) {
            @if ($index > 0) {
              <div class="transfer-row">
                <mat-icon class="transfer-icon">sync_alt</mat-icon>
                <span class="transfer-label">{{ segment.stopNames[0] }}</span>
              </div>
            }
            <div class="segment-block">
              <div class="segment-header" [class.expandable]="segment.stopNames.length > 2" (click)="toggleSegment($index)">
                <span class="segment-badge" [style.backgroundColor]="segment.lineColor">{{ segment.lineCode }}</span>
                <div class="segment-info">
                  <span class="segment-endpoints">{{ segment.stopNames[0] }} → {{ segment.stopNames[segment.stopNames.length - 1] }}</span>
                  <span class="segment-meta">dir. {{ segment.directionName }} · {{ segment.stopIds.length }} stops</span>
                </div>
                @if (segment.stopNames.length > 2) {
                  <mat-icon class="expand-icon">{{ expandedSegments().has($index) ? 'expand_less' : 'expand_more' }}</mat-icon>
                }
              </div>
              @if (expandedSegments().has($index) && segment.stopNames.length > 2) {
                <div class="segment-stops-list">
                  @for (name of segment.stopNames; track $index) {
                    <div class="stop-item">
                      <span class="stop-dot" [class.stop-endpoint]="$first || $last" [style.borderColor]="segment.lineColor"></span>
                      <span class="stop-name" [class.stop-endpoint-name]="$first || $last">{{ name }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
    }

    .route-search-panel {
      width: 230px;
      background: var(--app-map-overlay-bg);
      backdrop-filter: blur(10px);
      border: 1px solid var(--app-map-outline);
      border-radius: var(--app-radius-md);
      padding: 10px 12px;
      box-shadow: 0 4px 16px var(--app-map-shadow);
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-bottom: 6px;
    }

    .panel-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--app-map-accent);
    }

    .panel-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--app-map-on-surface-muted);
      flex: 1;
    }

    .clear-btn {
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

    .clear-btn:hover {
      background: var(--app-map-surface-container-higher);
    }

    .clear-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* --- Form fields --- */

    .search-field {
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

    .field-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      margin-right: 2px;
    }

    .departure-icon {
      color: var(--app-success);
    }

    .arrival-icon {
      color: var(--app-critical);
    }

    /* --- Separator with swap --- */

    .field-separator {
      display: flex;
      align-items: center;
      margin: -4px 0;
    }

    .connector-line {
      flex: 1;
      height: 1px;
      background: var(--app-map-outline-subtle);
    }

    .swap-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px;
      height: 26px;
      padding: 0;
      border: 1px solid var(--app-map-outline);
      border-radius: 50%;
      background: var(--app-map-surface-container-high);
      color: var(--app-map-on-surface-muted);
      cursor: pointer;
      flex-shrink: 0;
    }

    .swap-btn:hover {
      background: var(--app-map-surface-container-higher);
    }

    .swap-btn mat-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
    }

    /* --- Error --- */

    .error-hint {
      font-size: 11px;
      color: var(--app-critical);
      padding: 4px 4px 0;
    }

    /* --- Route breakdown --- */

    .route-breakdown {
      margin-top: 8px;
      padding-top: 8px;
      border-top: 1px solid var(--app-map-outline-subtle);
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .segment-block {
      display: flex;
      flex-direction: column;
    }

    .segment-header {
      display: flex;
      align-items: flex-start;
      gap: 8px;
    }

    .segment-header.expandable {
      cursor: pointer;
    }

    .segment-badge {
      padding: 2px 7px;
      border-radius: var(--app-radius-xs);
      font-size: 10px;
      font-weight: 700;
      color: white;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .segment-info {
      display: flex;
      flex-direction: column;
      gap: 1px;
      min-width: 0;
      flex: 1;
    }

    .segment-endpoints {
      font-size: 11px;
      color: var(--app-map-on-surface);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .segment-meta {
      font-size: 10px;
      color: var(--app-map-on-surface-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .expand-icon {
      font-size: 14px;
      width: 14px;
      height: 14px;
      color: var(--app-map-on-surface-muted);
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* --- Expanded stop list --- */

    .segment-stops-list {
      display: flex;
      flex-direction: column;
      padding: 4px 0 2px 15px;
      margin-left: 11px;
      border-left: 2px solid var(--app-map-outline-subtle);
    }

    .stop-item {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 2px 0;
    }

    .stop-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      border: 1.5px solid;
      background: transparent;
      flex-shrink: 0;
      margin-left: -9px;
    }

    .stop-dot.stop-endpoint {
      width: 7px;
      height: 7px;
      background: currentColor;
      margin-left: -10px;
    }

    .stop-name {
      font-size: 10px;
      color: var(--app-map-on-surface-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .stop-endpoint-name {
      color: var(--app-map-on-surface-variant);
      font-weight: 600;
    }

    /* --- Transfer --- */

    .transfer-row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding-left: 2px;
    }

    .transfer-icon {
      font-size: 12px;
      width: 12px;
      height: 12px;
      color: var(--app-map-on-surface-muted);
    }

    .transfer-label {
      font-size: 10px;
      color: var(--app-map-on-surface-muted);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    @media (max-width: 600px) {
      .route-search-panel {
        width: 190px;
        padding: 8px 10px;
      }
    }
  `
})
export class RouteSearchBarComponent {
  stops = input.required<LayoutStop[]>();
  departureStop = input<LayoutStop | null>(null);
  arrivalStop = input<LayoutStop | null>(null);
  routeResult = input<RouteResult | null>(null);

  searchRoute = output<{ from: string; to: string }>();
  clearRoute = output();
  departureChanged = output<LayoutStop | null>();
  arrivalChanged = output<LayoutStop | null>();

  departureCtrl = new FormControl<LayoutStop | string>('');
  arrivalCtrl = new FormControl<LayoutStop | string>('');

  selectedDeparture = signal<LayoutStop | null>(null);
  selectedArrival = signal<LayoutStop | null>(null);
  expandedSegments = signal(new Set<number>());

  private suppressSync = false;

  sameStopError = computed(() => {
    const dep = this.selectedDeparture();
    const arr = this.selectedArrival();
    return dep !== null && arr !== null && dep.id === arr.id;
  });

  filteredDepartures = computed(() => {
    const term = this.departureFilter();
    return this.filterStops(term);
  });

  filteredArrivals = computed(() => {
    const term = this.arrivalFilter();
    return this.filterStops(term);
  });

  private readonly departureFilter = signal('');
  private readonly arrivalFilter = signal('');

  constructor() {
    this.departureCtrl.valueChanges.pipe(takeUntilDestroyed()).subscribe(val => {
      if (typeof val === 'string') {
        this.departureFilter.set(val);
      }
    });

    this.arrivalCtrl.valueChanges.pipe(takeUntilDestroyed()).subscribe(val => {
      if (typeof val === 'string') {
        this.arrivalFilter.set(val);
      }
    });

    // Reset expanded segments when route changes
    effect(() => {
      this.routeResult();
      this.expandedSegments.set(new Set());
    });

    // Sync from parent (map click) → form controls
    effect(() => {
      const stop = this.departureStop();
      if (this.suppressSync) {return;}
      this.selectedDeparture.set(stop);
      this.departureCtrl.setValue(stop ?? '', { emitEvent: false });
      this.departureFilter.set('');
      this.tryAutoSearch();
    });

    effect(() => {
      const stop = this.arrivalStop();
      if (this.suppressSync) {return;}
      this.selectedArrival.set(stop);
      this.arrivalCtrl.setValue(stop ?? '', { emitEvent: false });
      this.arrivalFilter.set('');
      this.tryAutoSearch();
    });
  }

  displayFn = (value: LayoutStop | string): string => {
    if (!value) {return '';}
    if (typeof value === 'string') {return value;}
    return value.name;
  };

  onDepartureSelected(event: MatAutocompleteSelectedEvent): void {
    const stop = event.option.value as LayoutStop;
    this.selectedDeparture.set(stop);
    this.departureFilter.set('');
    this.suppressSync = true;
    try {
      this.departureChanged.emit(stop);
    } finally {
      this.suppressSync = false;
    }
    this.tryAutoSearch();
  }

  onArrivalSelected(event: MatAutocompleteSelectedEvent): void {
    const stop = event.option.value as LayoutStop;
    this.selectedArrival.set(stop);
    this.arrivalFilter.set('');
    this.suppressSync = true;
    try {
      this.arrivalChanged.emit(stop);
    } finally {
      this.suppressSync = false;
    }
    this.tryAutoSearch();
  }

  swapStops(): void {
    const dep = this.selectedDeparture();
    const arr = this.selectedArrival();

    this.selectedDeparture.set(arr);
    this.selectedArrival.set(dep);
    this.departureCtrl.setValue(arr ?? '', { emitEvent: false });
    this.arrivalCtrl.setValue(dep ?? '', { emitEvent: false });
    this.departureFilter.set('');
    this.arrivalFilter.set('');

    this.suppressSync = true;
    try {
      this.departureChanged.emit(arr);
      this.arrivalChanged.emit(dep);
    } finally {
      this.suppressSync = false;
    }

    this.tryAutoSearch();
  }

  clearSearch(): void {
    this.selectedDeparture.set(null);
    this.selectedArrival.set(null);
    this.departureCtrl.setValue('', { emitEvent: false });
    this.arrivalCtrl.setValue('', { emitEvent: false });
    this.departureFilter.set('');
    this.arrivalFilter.set('');
    this.suppressSync = true;
    try {
      this.departureChanged.emit(null);
      this.arrivalChanged.emit(null);
    } finally {
      this.suppressSync = false;
    }
    this.clearRoute.emit();
  }

  toggleSegment(index: number): void {
    const current = this.expandedSegments();
    const next = new Set(current);
    if (next.has(index)) {
      next.delete(index);
    } else {
      next.add(index);
    }
    this.expandedSegments.set(next);
  }

  private filterStops(term: string): LayoutStop[] {
    if (!term) {return this.stops();}
    const lower = term.toLowerCase();
    return this.stops().filter(s => s.name.toLowerCase().includes(lower));
  }

  private tryAutoSearch(): void {
    const dep = this.selectedDeparture();
    const arr = this.selectedArrival();
    if (dep && arr && dep.id !== arr.id) {
      this.searchRoute.emit({ from: dep.id, to: arr.id });
    }
  }
}
