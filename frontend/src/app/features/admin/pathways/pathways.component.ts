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
                      [attr.stroke]="edge.color"
                      [attr.stroke-width]="edge.strokeWidth"
                      [attr.stroke-dasharray]="edge.dash"
                      stroke-linecap="round"
                      vector-effect="non-scaling-stroke">
                      <title>{{ edge.tooltip }}</title>
                    </line>
                    @if (!edge.bidirectional) {
                      <polygon
                        [attr.points]="edge.arrowPoints"
                        [attr.fill]="edge.color" />
                    }
                  }
                  @for (node of g.nodes; track node.id) {
                    <g [class.is-current]="node.isCurrent">
                      <circle
                        [attr.cx]="node.x"
                        [attr.cy]="node.y"
                        [attr.r]="node.isCurrent ? 9 : 6"
                        [attr.fill]="node.isCurrent ? '#4338ca' : '#ffffff'"
                        [attr.stroke]="node.isCurrent ? '#4338ca' : '#9ca3af'"
                        stroke-width="1.5">
                        <title>{{ node.name }}</title>
                      </circle>
                      <text
                        [attr.x]="node.x"
                        [attr.y]="node.y - (node.isCurrent ? 14 : 10)"
                        text-anchor="middle"
                        font-size="10"
                        [attr.fill]="node.isCurrent ? '#4338ca' : 'currentColor'"
                        [attr.font-weight]="node.isCurrent ? 600 : 400">
                        {{ node.shortName }}
                      </text>
                    </g>
                  }
                </svg>
                <div class="graph-legend">
                  @for (item of g.legend; track item.mode) {
                    <span class="legend-chip">
                      <span class="legend-swatch" [style.backgroundColor]="item.color" [class.legend-dashed]="item.dashed"></span>
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
    }
    .legend-swatch.legend-dashed {
      background: none !important;
      border-top: 3px dashed var(--swatch-color, #888);
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

  /** Color per pathway mode — kept in one place so graph edges and the
   *  legend stay in sync. The choice favours readability on both
   *  light/dark backgrounds; STAIRS / ESCALATOR / ELEVATOR are the
   *  modes admins look at most when checking accessibility. */
  private static readonly MODE_COLORS: Record<PathwayMode, string> = {
    WALKWAY: '#6b7280',
    STAIRS: '#dc2626',
    MOVING_SIDEWALK: '#0ea5e9',
    ESCALATOR: '#f59e0b',
    ELEVATOR: '#16a34a',
    FARE_GATE: '#a855f7',
    EXIT_GATE: '#a855f7',
  };

  /** Build the SVG layout for the pathways graph. Stops are positioned
   *  on a BFS grid rooted at the selected stop: column = BFS depth,
   *  row = arrival order at that depth. The result keeps the selected
   *  stop on the left, branches outward visually, and stays stable
   *  whenever the underlying graph topology stays stable. */
  readonly graphLayout = computed<PathwayGraphLayout | null>(() => {
    const pathways = this.pathways();
    const root = this.selectedStop();
    if (pathways.length === 0 || !root) {return null;}
    return PathwaysComponent.buildLayout(pathways, root.id, this.transloco);
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
    return this.transloco.translate(`transit.pathwayMode.${mode}`);
  }

  /** Pure helper kept static so unit tests can call it without a TestBed.
   *  BFS from {@code rootStopId}, layout nodes on a grid (column = depth,
   *  row = order of arrival), then materialise edges with stroke / dash
   *  / arrow attributes. */
  // transloco is optional so unit tests can call buildLayout without
  // wiring a Transloco TestBed; the legend label falls back to the
  // raw enum when omitted.
  static buildLayout(pathways: Pathway[], rootStopId: string, transloco?: TranslocoService): PathwayGraphLayout {
    const nodeNames = new Map<string, string>();
    const adjacency = new Map<string, string[]>();
    for (const p of pathways) {
      nodeNames.set(p.fromStopId, p.fromStopName);
      nodeNames.set(p.toStopId, p.toStopName);
      const fwd = adjacency.get(p.fromStopId) ?? [];
      fwd.push(p.toStopId);
      adjacency.set(p.fromStopId, fwd);
      if (p.bidirectional) {
        const rev = adjacency.get(p.toStopId) ?? [];
        rev.push(p.fromStopId);
        adjacency.set(p.toStopId, rev);
      }
    }
    nodeNames.set(rootStopId, nodeNames.get(rootStopId) ?? '—');

    // BFS — depth tracks the column, queue order within a depth tracks
    // the row. Stops unreachable from the root still need a position so
    // their pathways render: they are placed in a "rest" column after
    // the BFS-reached stops.
    const depth = new Map<string, number>();
    depth.set(rootStopId, 0);
    const queue: string[] = [rootStopId];
    let head = 0;
    while (head < queue.length) {
      const cursor = queue[head++];
      if (cursor === undefined) {continue;}
      const currentDepth = depth.get(cursor) ?? 0;
      for (const neighbour of adjacency.get(cursor) ?? []) {
        if (!depth.has(neighbour)) {
          depth.set(neighbour, currentDepth + 1);
          queue.push(neighbour);
        }
      }
    }
    let restColumn = 0;
    for (const id of nodeNames.keys()) {
      if (!depth.has(id)) {
        depth.set(id, ++restColumn + Math.max(...depth.values()));
      }
    }

    // Group stop ids by depth, preserving BFS order within each layer.
    const byDepth = new Map<number, string[]>();
    for (const id of queue) {
      const d = depth.get(id) ?? 0;
      const list = byDepth.get(d) ?? [];
      list.push(id);
      byDepth.set(d, list);
    }
    for (const id of nodeNames.keys()) {
      if (!queue.includes(id)) {
        const d = depth.get(id) ?? 0;
        const list = byDepth.get(d) ?? [];
        if (!list.includes(id)) {
          list.push(id);
          byDepth.set(d, list);
        }
      }
    }

    const colWidth = 140;
    const rowHeight = 70;
    const padding = 40;
    const positions = new Map<string, { x: number; y: number }>();
    for (const [d, ids] of byDepth) {
      ids.forEach((id, idx) => {
        positions.set(id, {
          x: padding + d * colWidth,
          y: padding + idx * rowHeight,
        });
      });
    }

    const maxDepth = Math.max(0, ...depth.values());
    const maxRows = Math.max(0, ...[...byDepth.values()].map(l => l.length));
    const width = padding * 2 + maxDepth * colWidth;
    const height = padding * 2 + Math.max(0, maxRows - 1) * rowHeight;

    const nodes: PathwayGraphNode[] = [];
    for (const [id, name] of nodeNames) {
      const pos = positions.get(id) ?? { x: 0, y: 0 };
      nodes.push({
        id,
        name,
        shortName: PathwaysComponent.shortenName(name),
        x: pos.x,
        y: pos.y,
        isCurrent: id === rootStopId,
      });
    }

    const edges: PathwayGraphEdge[] = [];
    const seen = new Set<string>();
    for (const p of pathways) {
      const from = positions.get(p.fromStopId);
      const to = positions.get(p.toStopId);
      if (!from || !to) {continue;}
      const canonical = p.fromStopId < p.toStopId
          ? `${p.fromStopId}|${p.toStopId}|${p.pathwayMode}`
          : `${p.toStopId}|${p.fromStopId}|${p.pathwayMode}`;
      if (seen.has(canonical)) {continue;}
      seen.add(canonical);

      const color = PathwaysComponent.MODE_COLORS[p.pathwayMode];
      const dash = p.pathwayMode === 'STAIRS' ? '4 4' : null;
      // Stroke width scales with traversal time so longer pathways read
      // as visually heavier — capped to keep the SVG readable.
      const strokeWidth = p.traversalTimeSeconds === null
          ? 1.5
          : Math.min(4, 1.2 + p.traversalTimeSeconds / 80);
      const tooltipParts: string[] = [];
      tooltipParts.push(`${p.fromStopName} → ${p.toStopName}`);
      if (p.lengthMetres !== null) {tooltipParts.push(`${p.lengthMetres} m`);}
      if (p.traversalTimeSeconds !== null) {tooltipParts.push(`${p.traversalTimeSeconds} s`);}
      // Pre-compute the arrow head only for one-way pathways. The arrow
      // is a small triangle landing 14px before the target node so the
      // line does not visually pierce the circle.
      const arrowPoints = p.bidirectional
          ? ''
          : PathwaysComponent.arrowPolygon(from.x, from.y, to.x, to.y, 12, 6);

      edges.push({
        key: canonical,
        x1: from.x, y1: from.y,
        x2: to.x, y2: to.y,
        color,
        strokeWidth,
        dash,
        bidirectional: p.bidirectional,
        arrowPoints,
        tooltip: tooltipParts.join(' • '),
      });
    }

    const usedModes = new Set<PathwayMode>(pathways.map(p => p.pathwayMode));
    const legend: PathwayGraphLegendEntry[] = [];
    for (const mode of usedModes) {
      legend.push({
        mode,
        label: PathwaysComponent.modeLabelStatic(mode, transloco),
        color: PathwaysComponent.MODE_COLORS[mode],
        dashed: mode === 'STAIRS',
      });
    }

    return {
      nodes,
      edges,
      legend,
      viewBox: `0 0 ${Math.max(width, 200)} ${Math.max(height + padding, 160)}`,
    };
  }

  /** Compact display name — keeps SVG labels readable on small graphs.
   *  Picks the part after the last separator (em-dash, hyphen, slash)
   *  when the name is long. */
  private static shortenName(name: string): string {
    if (name.length <= 18) {return name;}
    const sep = / [—\-/]\s+/;
    const parts = name.split(sep);
    const last = parts[parts.length - 1];
    if (last !== undefined && last.length > 0 && last.length <= 18) {
      return last;
    }
    return name.slice(0, 17) + '…';
  }

  private static modeLabelStatic(mode: PathwayMode, transloco?: TranslocoService): string {
    return transloco ? transloco.translate(`transit.pathwayMode.${mode}`) : mode;
  }

  /** Build a triangle polygon pointing from (x1,y1) toward (x2,y2),
   *  with the tip placed at distance {@code tipBack} before the target
   *  to avoid overlapping the destination circle. */
  private static arrowPolygon(
    x1: number, y1: number, x2: number, y2: number,
    tipBack: number, half: number,
  ): string {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (len === 0) {return '';}
    const ux = dx / len;
    const uy = dy / len;
    const tipX = x2 - ux * tipBack;
    const tipY = y2 - uy * tipBack;
    const baseX = tipX - ux * tipBack;
    const baseY = tipY - uy * tipBack;
    const leftX = baseX + uy * half;
    const leftY = baseY - ux * half;
    const rightX = baseX - uy * half;
    const rightY = baseY + ux * half;
    return `${tipX},${tipY} ${leftX},${leftY} ${rightX},${rightY}`;
  }
}

export interface PathwayGraphNode {
  id: string;
  name: string;
  shortName: string;
  x: number;
  y: number;
  isCurrent: boolean;
}

export interface PathwayGraphEdge {
  key: string;
  x1: number; y1: number;
  x2: number; y2: number;
  color: string;
  strokeWidth: number;
  dash: string | null;
  bidirectional: boolean;
  arrowPoints: string;
  tooltip: string;
}

export interface PathwayGraphLegendEntry {
  mode: PathwayMode;
  label: string;
  color: string;
  dashed: boolean;
}

export interface PathwayGraphLayout {
  nodes: PathwayGraphNode[];
  edges: PathwayGraphEdge[];
  legend: PathwayGraphLegendEntry[];
  viewBox: string;
}
