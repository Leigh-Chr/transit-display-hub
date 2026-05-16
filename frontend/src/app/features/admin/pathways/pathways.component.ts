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
  template: `
    <ng-container *transloco="let t">
    <div class="pathways-page">
      <div class="page-header">
        <h1 class="page-title">{{ t('admin.pathways.title') }}</h1>
        <p class="page-subtitle">{{ t('admin.pathways.subtitle') }}</p>
      </div>

      <mat-form-field appearance="outline" class="stop-picker">
        <mat-label>{{ t('admin.pathways.stopPickerLabel') }}</mat-label>
        <input
          type="text"
          matInput
          [(ngModel)]="search"
          (ngModelChange)="onSearchChange()"
          [matAutocomplete]="auto"
          [placeholder]="t('admin.pathways.stopPickerPlaceholder')">
        <mat-autocomplete #auto="matAutocomplete" (optionSelected)="onStopSelected($event.option.value)">
          @for (s of filteredStops(); track s.id) {
            <mat-option [value]="s">
              {{ s.name }}
              @if (s.platformCode) {
                <span class="platform">{{ t('admin.pathways.platform', { code: s.platformCode }) }}</span>
              }
            </mat-option>
          }
        </mat-autocomplete>
        <mat-icon matSuffix>place</mat-icon>
      </mat-form-field>

      @if (selectedStop(); as stop) {
        <div class="selected-stop">
          <h2>{{ stop.name }}</h2>
          @if (stationLevels().length > 0) {
            <div class="levels-row">
              <mat-icon class="levels-icon" [matTooltip]="t('admin.pathways.levelsTooltip')">layers</mat-icon>
              <span class="levels-label">{{ stationName() || t('admin.pathways.stationDefault') }} :</span>
              @for (lvl of stationLevels(); track lvl.id) {
                <span class="level-chip" [matTooltip]="'level_index = ' + lvl.index">
                  {{ lvl.name || t('admin.pathways.levelDefault', { index: lvl.index }) }}
                </span>
              }
            </div>
          }
          @if (loadError()) {
            <app-empty-state
              icon="error_outline"
              [title]="t('admin.pathways.loadFailed')"
              [description]="t('admin.common.loadErrorDescription')"
              [actionLabel]="t('common.refresh')"
              actionIcon="refresh"
              (action)="loadPathways()" />
          } @else if (pathways().length === 0) {
            <app-empty-state
              icon="alt_route"
              [title]="t('admin.pathways.emptyPathwayTitle')"
              [description]="t('admin.pathways.emptyPathwayDesc')" />
          } @else {
            @if (graphLayout(); as g) {
              <div class="pathway-graph">
                <h3 class="graph-title">
                  <mat-icon class="graph-icon">hub</mat-icon>
                  {{ t('admin.pathways.graphTitle') }}
                </h3>
                <svg
                  class="graph-svg"
                  [attr.viewBox]="g.viewBox"
                  preserveAspectRatio="xMidYMid meet"
                  role="img"
                  [attr.aria-label]="t('admin.pathways.graphAria')"
                >
                  <!-- edges first so node circles render on top -->
                  @for (edge of g.edges; track edge.key) {
                    <line
                      [attr.x1]="edge.x1"
                      [attr.y1]="edge.y1"
                      [attr.x2]="edge.x2"
                      [attr.y2]="edge.y2"
                      [class]="'pathway-edge ' + edge.modeClass"
                      stroke="currentColor"
                      [attr.stroke-width]="edge.strokeWidth"
                      [attr.stroke-dasharray]="edge.dash"
                      stroke-linecap="round"
                      vector-effect="non-scaling-stroke">
                      <title>{{ edge.tooltip }}</title>
                    </line>
                    @if (!edge.bidirectional) {
                      <polygon
                        [attr.points]="edge.arrowPoints"
                        [class]="'pathway-arrow ' + edge.modeClass"
                        fill="currentColor" />
                    }
                  }
                  @for (node of g.nodes; track node.id) {
                    <g [class.is-current]="node.isCurrent" class="pathway-node">
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        [attr.r]="node.isCurrent ? 9 : 6"
                        class="pathway-node-circle"
                        stroke-width="1.5">
                        <title>{{ node.name }}</title>
                      </circle>
                      <text
                        [attr.x]="node.x"
                        [attr.y]="node.y - (node.isCurrent ? 14 : 10)"
                        text-anchor="middle"
                        font-size="10"
                        class="pathway-node-label"
                        [attr.font-weight]="node.isCurrent ? 600 : 400">
                        {{ node.shortName }}
                      </text>
                    </g>
                  }
                </svg>
                <div class="graph-legend">
                  @for (item of g.legend; track item.mode) {
                    <span class="legend-chip">
                      <span [class]="'legend-swatch ' + item.modeClass" [class.legend-dashed]="item.dashed"></span>
                      {{ item.label }}
                    </span>
                  }
                </div>
              </div>
            }

            <div class="pathways-table-wrapper">
              <table mat-table [dataSource]="pathways()" class="pathways-table">
                <ng-container matColumnDef="mode">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.pathways.colMode') }}</th>
                  <td mat-cell *matCellDef="let p">
                    <mat-icon class="mode-icon" [matTooltip]="modeLabel(p.pathwayMode)">
                      {{ modeIcon(p.pathwayMode) }}
                    </mat-icon>
                  </td>
                </ng-container>

                <ng-container matColumnDef="from">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.pathways.colFrom') }}</th>
                  <td mat-cell *matCellDef="let p">
                    <strong [class.current]="p.fromStopId === selectedStop()?.id">
                      {{ p.fromStopName }}
                    </strong>
                  </td>
                </ng-container>

                <ng-container matColumnDef="direction">
                  <th mat-header-cell *matHeaderCellDef></th>
                  <td mat-cell *matCellDef="let p">
                    <mat-icon class="direction-icon">
                      {{ p.bidirectional ? 'sync_alt' : 'arrow_forward' }}
                    </mat-icon>
                  </td>
                </ng-container>

                <ng-container matColumnDef="to">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.pathways.colTo') }}</th>
                  <td mat-cell *matCellDef="let p">
                    <strong [class.current]="p.toStopId === selectedStop()?.id">
                      {{ p.toStopName }}
                    </strong>
                  </td>
                </ng-container>

                <ng-container matColumnDef="signpost">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.pathways.colSignpost') }}</th>
                  <td mat-cell *matCellDef="let p">
                    @if (p.signpostedAs || p.reversedSignpostedAs) {
                      <span class="signpost">
                        @if (p.signpostedAs) { {{ p.signpostedAs }} }
                        @if (p.bidirectional && p.reversedSignpostedAs) {
                          <span class="muted"> / {{ p.reversedSignpostedAs }}</span>
                        }
                      </span>
                    } @else { — }
                  </td>
                </ng-container>

                <ng-container matColumnDef="length">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.pathways.colLength') }}</th>
                  <td mat-cell *matCellDef="let p">
                    {{ p.lengthMetres !== null ? (p.lengthMetres + ' m') : '—' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="time">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.pathways.colTime') }}</th>
                  <td mat-cell *matCellDef="let p">
                    {{ p.traversalTimeSeconds !== null ? (p.traversalTimeSeconds + ' s') : '—' }}
                  </td>
                </ng-container>

                <ng-container matColumnDef="details">
                  <th mat-header-cell *matHeaderCellDef>{{ t('admin.pathways.colDetails') }}</th>
                  <td mat-cell *matCellDef="let p" class="details-cell">
                    @if (p.stairCount) {
                      <span class="detail-chip"><mat-icon>stairs</mat-icon>{{ p.stairCount }}</span>
                    }
                    @if (p.maxSlope) {
                      <span class="detail-chip"><mat-icon>trending_up</mat-icon>{{ p.maxSlope }}</span>
                    }
                    @if (p.minWidthMetres) {
                      <span class="detail-chip"><mat-icon>width_full</mat-icon>{{ p.minWidthMetres }} m</span>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="columns"></tr>
                <tr mat-row *matRowDef="let row; columns: columns"></tr>
              </table>
            </div>
          }
        </div>
      } @else {
        <app-empty-state
          icon="search"
          [title]="t('admin.pathways.emptySelectTitle')"
          [description]="t('admin.pathways.emptySelectDesc')" />
      }
    </div>
    </ng-container>
  `,
  styles: `
    .pathways-page { max-width: 1300px; }
    .page-header { margin-bottom: 24px; }
    .page-title { margin: 0 0 4px 0; font-size: var(--m3-type-headline-medium); font-weight: 600; }
    .page-subtitle { margin: 0; color: var(--mat-sys-on-surface-variant); }

    .stop-picker { width: 100%; max-width: 480px; margin-bottom: 24px; }
    .platform { color: var(--mat-sys-on-surface-variant); font-size: 0.85em; margin-left: 4px; }

    .selected-stop h2 {
      margin: 0 0 16px 0;
      font-size: var(--m3-type-title-large);
      font-weight: 600;
    }

    .pathways-table-wrapper {
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
      overflow-x: auto;
    }
    .pathways-table { width: 100%; }
    .pathways-table td, .pathways-table th { font-variant-numeric: tabular-nums; }

    .mode-icon { color: var(--mat-sys-primary); }
    .direction-icon {
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
      color: var(--mat-sys-on-surface-variant);
    }
    .current { color: var(--mat-sys-primary); }
    .signpost { font-style: italic; }
    .muted { color: var(--mat-sys-on-surface-variant); }

    .details-cell {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }
    .detail-chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 1px 8px;
      background: var(--mat-sys-surface-container-high);
      border-radius: 999px;
      font-size: var(--m3-type-label-medium);
    }
    .detail-chip mat-icon {
      font-size: var(--m3-type-body-small);
      width: 13px;
      height: 13px;
    }
    .levels-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin: 4px 0 12px;
      padding: 8px 12px;
      background: rgba(99, 102, 241, 0.08);
      border-radius: 8px;
      font-size: var(--m3-type-body-medium);
    }
    .levels-icon {
      color: #4338ca;
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
    }
    .levels-label {
      font-weight: 500;
      color: var(--mat-sys-on-surface-variant);
    }
    .level-chip {
      padding: 2px 8px;
      border-radius: 999px;
      background: rgba(99, 102, 241, 0.18);
      color: #4338ca;
      font-size: var(--m3-type-label-medium);
      font-weight: 500;
    }

    .pathway-graph {
      margin: 0 0 20px;
      padding: 14px 18px;
      background: var(--mat-sys-surface-container);
      border-radius: 8px;
    }
    .graph-title {
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 0 10px;
      font-size: var(--m3-type-body-medium);
      font-weight: 600;
      color: var(--mat-sys-on-surface-variant);
    }
    .graph-icon {
      font-size: var(--m3-type-title-large);
      width: 18px;
      height: 18px;
    }
    .graph-svg {
      display: block;
      width: 100%;
      max-height: 360px;
      background: var(--mat-sys-surface);
      border-radius: 6px;
    }
    .graph-svg .is-current circle {
      filter: drop-shadow(0 0 6px rgba(99, 102, 241, 0.45));
    }
    .graph-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin-top: 10px;
      font-size: var(--m3-type-label-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .legend-chip {
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .legend-swatch {
      display: inline-block;
      width: 22px;
      height: 3px;
      border-radius: 2px;
      background-color: currentColor;
    }
    .legend-swatch.legend-dashed {
      background: none;
      border-top: 3px dashed currentColor;
    }
    /* --- Pathway mode palette ---
       One CSS class per GTFS pathway_mode value. The SVG markup uses
       stroke=currentColor (lines) and fill=currentColor (arrowheads,
       legend swatches) so the colour on the wrapping class flows
       through without the layout helper having to hardcode a hex.
       STAIRS / ESCALATOR / ELEVATOR map to the same critical / warning
       / success semantic tokens used elsewhere so a theme change
       automatically lights up the right hue. */
    .pathway-mode-walkway        { color: var(--mat-sys-outline, #6b7280); }
    .pathway-mode-stairs         { color: var(--app-critical, #dc2626); }
    .pathway-mode-moving-sidewalk{ color: var(--app-info, #0ea5e9); }
    .pathway-mode-escalator      { color: var(--app-warning, #f59e0b); }
    .pathway-mode-elevator       { color: var(--app-success, #16a34a); }
    .pathway-mode-fare-gate,
    .pathway-mode-exit-gate      { color: var(--app-chip-accent-fg, #a855f7); }

    /* --- Pathway nodes ---
       Default node = white fill on the surface, with the inactive
       outline. The .is-current modifier (added to the wrapping group)
       promotes the node to the chip-info token so the focused stop
       pops without us hardcoding indigo-700 inline. */
    .pathway-node-circle {
      fill: var(--mat-sys-surface, #ffffff);
      stroke: var(--mat-sys-outline-variant, #9ca3af);
    }
    .pathway-node-label {
      fill: currentColor;
    }
    .pathway-node.is-current .pathway-node-circle {
      fill: var(--app-chip-info-fg);
      stroke: var(--app-chip-info-fg);
    }
    .pathway-node.is-current .pathway-node-label {
      fill: var(--app-chip-info-fg);
    }
  `,
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

