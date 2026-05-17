import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  input,
  output,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslocoDirective } from '@jsverse/transloco';
import {
  StopAutocompleteComponent,
  StopAutocompleteOption,
} from '@shared/components/stop-autocomplete/stop-autocomplete.component';
import { LayoutStop } from '../../services/schematic-layout.service';
import { RouteResult } from '../../services/route-finder.service';

@Component({
  selector: 'app-route-search-bar',
  standalone: true,
  imports: [
    MatIconModule,
    StopAutocompleteComponent,
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

  /** Locally tracked selections — kept in sync with the `departureStop`
   *  / `arrivalStop` inputs (parent → child) and emitted through the
   *  `*Changed` outputs (child → parent). The dual-direction wiring is
   *  needed because the map click sets the inputs while the autocomplete
   *  selection is owned here. */
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

  constructor() {
    // Reset expanded segments when route changes
    effect(() => {
      this.routeResult();
      this.expandedSegments.set(new Set());
    });

    // Sync from parent (map click) → local selection signals.
    effect(() => {
      const stop = this.departureStop();
      if (this.suppressSync) {return;}
      this.selectedDeparture.set(stop);
      this.tryAutoSearch();
    });

    effect(() => {
      const stop = this.arrivalStop();
      if (this.suppressSync) {return;}
      this.selectedArrival.set(stop);
      this.tryAutoSearch();
    });
  }

  onDepartureSelected(option: StopAutocompleteOption): void {
    const stop = option as LayoutStop;
    this.selectedDeparture.set(stop);
    this.suppressSync = true;
    try {
      this.departureChanged.emit(stop);
    } finally {
      this.suppressSync = false;
    }
    this.tryAutoSearch();
  }

  onArrivalSelected(option: StopAutocompleteOption): void {
    const stop = option as LayoutStop;
    this.selectedArrival.set(stop);
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

  private tryAutoSearch(): void {
    const dep = this.selectedDeparture();
    const arr = this.selectedArrival();
    if (dep && arr && dep.id !== arr.id) {
      this.searchRoute.emit({ from: dep.id, to: arr.id });
    }
  }
}
