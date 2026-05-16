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
import { TranslocoDirective } from '@jsverse/transloco';
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
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './route-search-bar.component.html',
  styleUrl: './route-search-bar.component.scss'
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

  /** Both endpoints picked, distinct, but the router could not connect them.
   *  Without this hint the panel just stays silent after the search and the
   *  user can't tell whether the calculation finished or just failed. */
  noRouteFound = computed(() => {
    const dep = this.selectedDeparture();
    const arr = this.selectedArrival();
    if (!dep || !arr || dep.id === arr.id) {return false;}
    return this.routeResult() === null;
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

  /** Pick the singular / plural i18n key for the stop count without
   *  needing the messageformat plugin (we only ship the basic loader). */
  stopsLabel(count: number, t: (key: string, params?: Record<string, unknown>) => string): string {
    return t(count === 1 ? 'stopOne' : 'stopOther', { count });
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
