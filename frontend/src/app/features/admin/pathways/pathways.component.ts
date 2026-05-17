import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { GtfsDataService } from '@core/api/gtfs-data.service';
import { StopService } from '@core/api/stop.service';
import { NetworkMapDataService } from '@features/network-map/services/network-map-data.service';
import { Pathway, PathwayMode, StationLevelInfo, Stop } from '@shared/models';
import { EmptyStateComponent } from '@shared/components/empty-state/empty-state.component';
import { TranslocoDirective, TranslocoService } from '@jsverse/transloco';
import { httpErrorMessage } from '@shared/utils/http.utils';
import { PathwayGraphLayout, buildPathwayGraphLayout } from './pathway-graph-layout';

/**
 * Browse the indoor topology — pathways.txt — around any stop.
 *
 * The autocomplete narrows the list as the admin types: feed-level
 * stop counts get into the thousands, so picking from a static
 * dropdown isn't workable. Stops without ingoing/outgoing segments
 * legitimately render an empty state.
 */
@Component({
  selector: 'app-pathways',
  standalone: true,
  imports: [
    FormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatCardModule,
    MatChipsModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTableModule,
    MatTooltipModule,
    EmptyStateComponent,
    TranslocoDirective,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pathways.component.html',
  styleUrl: './pathways.component.scss',
})
export class PathwaysComponent implements OnInit {
  private readonly gtfsData = inject(GtfsDataService);
  private readonly stopService = inject(StopService);
  private readonly networkMapData = inject(NetworkMapDataService);
  private readonly transloco = inject(TranslocoService);

  readonly pathways = signal<Pathway[]>([]);
  readonly stationLevels = signal<StationLevelInfo[]>([]);
  readonly stationName = signal<string | null>(null);
  readonly selectedStop = signal<Stop | null>(null);
  readonly stops = signal<Stop[]>([]);
  readonly filteredStops = signal<Stop[]>([]);
  readonly loadError = signal<string | null>(null);

  search = '';

  readonly columns = ['mode', 'from', 'direction', 'to', 'signpost', 'length', 'time', 'details'];

  /** Build the SVG layout for the pathways graph via the
   *  buildPathwayGraphLayout helper (extracted to its own module in
   *  v1.19.0 so the BFS + geometry are testable without a TestBed). */
  readonly graphLayout = computed<PathwayGraphLayout | null>(() => {
    const pathways = this.pathways();
    const root = this.selectedStop();
    if (pathways.length === 0 || !root) {return null;}
    return buildPathwayGraphLayout(pathways, root.id, this.transloco);
  });

  ngOnInit(): void {
    this.stopService.getAll().subscribe({
      next: (data) => {
        this.stops.set(data);
        this.filteredStops.set(data.slice(0, 30));
      },
      error: () => this.stops.set([]),
    });
  }

  onSearchChange(): void {
    if (typeof this.search === 'object') {return;} // autocomplete passes the object
    const q = this.search.toLowerCase().trim();
    if (!q) {
      this.filteredStops.set(this.stops().slice(0, 30));
      return;
    }
    this.filteredStops.set(
      this.stops()
        .filter(s => s.name.toLowerCase().includes(q))
        .slice(0, 30)
    );
  }

  onStopSelected(stop: Stop): void {
    this.selectedStop.set(stop);
    this.search = stop.name;
    this.loadPathways();
  }

  loadPathways(): void {
    const stop = this.selectedStop();
    if (!stop) { return; }
    this.loadError.set(null);
    this.gtfsData.getPathwaysForStop(stop.id).subscribe({
      next: (data) => this.pathways.set(data),
      error: (err: unknown) => {
        this.pathways.set([]);
        this.loadError.set(httpErrorMessage(err, this.transloco.translate('admin.pathways.loadFailed')));
      },
    });
    this.networkMapData.getStopPathwayGraph(stop.id).subscribe({
      next: (graph) => {
        this.stationLevels.set(graph?.levels ?? []);
        this.stationName.set(graph?.stationName ?? null);
      },
      error: () => {
        this.stationLevels.set([]);
        this.stationName.set(null);
      },
    });
  }

  modeIcon(mode: PathwayMode): string {
    switch (mode) {
      case 'WALKWAY': return 'directions_walk';
      case 'STAIRS': return 'stairs';
      case 'MOVING_SIDEWALK': return 'commit';
      case 'ESCALATOR': return 'escalator';
      case 'ELEVATOR': return 'elevator';
      case 'FARE_GATE': return 'lock';
      case 'EXIT_GATE': return 'logout';
    }
  }

  modeLabel(mode: PathwayMode): string {
    return this.transloco.translate(`map.transit.pathwayMode.${mode}`);
  }

  /** Static bridge kept so the existing spec keeps compiling — forwards to
   *  the buildPathwayGraphLayout pure helper extracted in v1.19.0. The
   *  pathway-graph-layout.ts module is the canonical entry point for any
   *  new caller.
   */
  static buildLayout(pathways: Pathway[], rootStopId: string, transloco?: TranslocoService): PathwayGraphLayout {
    return buildPathwayGraphLayout(pathways, rootStopId, transloco);
  }
}

