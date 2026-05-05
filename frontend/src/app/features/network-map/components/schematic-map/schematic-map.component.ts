import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { linkedQueryParam } from 'ngxtension/linked-query-param';
import { MessageSeverity, NetworkLine, NetworkMapAlerts } from '@shared/models';
import { LayoutStop } from '../../services/schematic-layout.service';
import { NetworkRowLayoutService } from '../../services/network-row-layout.service';
import { RouteResult } from '../../services/route-finder.service';
import { SvgPanZoom } from '../../utils/svg-pan-zoom';
import { exportSvgToFile } from '../../utils/svg-export';
import { AlertOverlayComponent, VisibleLineAlert } from '../alert-overlay/alert-overlay.component';
import { LineFilterChipsComponent } from '../line-filter-chips/line-filter-chips.component';
import { MapLegendComponent } from '../map-legend/map-legend.component';
import { ZoomControlsComponent } from '../zoom-controls/zoom-controls.component';

interface NetworkLineRow {
  line: NetworkLine;
  y: number;
  stops: { stop: LayoutStop; x: number }[];
  path: string;
}

interface InterchangeConnector {
  stopId: string;
  name: string;
  /** SVG path data for the straight vertical line between the topmost
   *  and bottommost row that hosts this interchange. */
  path: string;
}

interface NetworkStopLabel {
  stop: LayoutStop;
  lineId: string;
  x: number;
  y: number;
  /** Whether the rotated label fans up-right (above the row) or down-right (below). */
  orientation: 'up' | 'down';
}

function severityRank(s: MessageSeverity): number {
  switch (s) { case 'INFO': return 0; case 'WARNING': return 1; case 'CRITICAL': return 2; }
}

@Component({
  selector: 'app-schematic-map',
  standalone: true,
  imports: [
    AlertOverlayComponent,
    LineFilterChipsComponent,
    MapLegendComponent,
    ZoomControlsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="map-container" #container>
      <app-line-filter-chips
        [lines]="sortedLines()"
        [visibleLineCodes]="visibleLineCodes()"
        [alertSeverityByLineId]="lineAlertSeverityMap()"
        (lineToggle)="toggleLine($event)"
        (toggleAll)="toggleAllLines()"
        (focusLine)="showOnlyLine($event)"
      />

      @if (visibleLineCodes().length === 0) {
        <div class="empty-selection">
          <span class="empty-selection-text">Select a line to display it on the map</span>
        </div>
      } @else {
      <!-- Diagram with zoom/pan -->
      <div
        class="line-diagram-wrapper"
        tabindex="0"
        (wheel)="onWheel($event)"
        (keydown)="onKeyDown($event)"
        (mousedown)="onPointerDown($event)"
        (mousemove)="onPointerMove($event)"
        (mouseup)="onPointerUp()"
        (mouseleave)="onPointerUp()"
        (touchstart)="onTouchStart($event)"
        (touchmove)="onTouchMove($event)"
        (touchend)="onPointerUp()"
        [class.grabbing]="isPanning()"
      >
        <svg
          #svgElement
          [attr.viewBox]="currentViewBox()"
          preserveAspectRatio="xMidYMid meet"
          class="line-diagram network-diagram"
        >
          <!-- Interchange connectors (gently curved dashed paths) — multi-line
               only. vector-effect keeps the dashed stroke at constant screen
               width regardless of zoom; the path geometry still scales with
               the row positions. -->
          @if (!isSingleLineMode()) {
            @for (conn of interchangeConnectors(); track conn.stopId) {
              <path
                [attr.d]="conn.path"
                fill="none"
                vector-effect="non-scaling-stroke"
                class="interchange-connector"
                [class.route-dimmed]="hasRoute() && !routeTransferIds().has(conn.stopId)"
              />
            }
          }

          <!-- Line paths. vector-effect keeps the stroke width fixed in
               screen pixels: the path geometry still tracks the row stops
               but the line thickness stays constant at any zoom level. -->
          @for (row of networkLineRows(); track row.line.id) {
            <path
              [attr.d]="row.path"
              [attr.stroke]="row.line.color"
              [attr.stroke-width]="getLineStrokeWidth(row.line)"
              fill="none"
              stroke-linecap="round"
              vector-effect="non-scaling-stroke"
              class="network-line-path"
              [class.route-dimmed]="hasRoute()"
            />
          }

          <!-- Route overlay paths (highlighted active route) -->
          @if (hasRoute()) {
            @for (overlay of routeOverlayPaths(); track overlay.lineId) {
              <path
                [attr.d]="overlay.path"
                [attr.stroke]="overlay.color"
                [attr.stroke-width]="getRouteStrokeWidth(overlay.lineId)"
                fill="none"
                stroke-linecap="round"
                vector-effect="non-scaling-stroke"
                class="route-active-path"
              />
            }
            @for (arrow of routeDirectionArrows(); track arrow.x + ':' + arrow.y) {
              <g [attr.transform]="'translate(' + arrow.x + ',' + arrow.y + ') scale(' + invZoom() + ')'"
                 class="route-arrow">
                <polygon
                  [attr.points]="arrow.right ? '-5,-4 5,0 -5,4' : '5,-4 -5,0 5,4'"
                  fill="white"
                  opacity="0.9"
                />
              </g>
            }
          }

          <!-- Line code badges + name (left of each row). Anchored on the
               first stop's geometry but scaled inversely with zoom so the
               badge keeps its screen size at any zoom level. -->
          @for (row of networkLineRows(); track row.line.id) {
            @if (row.stops.length > 0) {
              <g [attr.transform]="'translate(' + ((row.stops[0]?.x ?? 0) - 40) + ',' + row.y + ') scale(' + invZoom() + ')'"
                 [class.route-dimmed]="hasRoute() && !routeActiveEdges().has(row.line.id)">
                <rect
                  [attr.x]="-30"
                  [attr.y]="-16"
                  [attr.width]="getLineBadgeWidth(row.line.code)"
                  height="32"
                  rx="6"
                  [attr.fill]="row.line.color"
                  class="line-badge-bg"
                />
                <text
                  [attr.x]="getLineBadgeWidth(row.line.code) / 2 - 30"
                  dominant-baseline="central"
                  text-anchor="middle"
                  class="line-badge-text"
                >{{ row.line.code }}</text>
                @if (row.line.name && row.line.name !== row.line.code) {
                  <g [attr.transform]="'translate(-30, 32)'">
                    @if (row.line.type) {
                      <g transform="translate(0, -9) scale(0.9)" class="line-type-icon">
                        <path [attr.d]="getTransportIcon(row.line.type)"/>
                      </g>
                    }
                    <text
                      [attr.x]="row.line.type ? 22 : 0"
                      dominant-baseline="central"
                      class="line-name-label"
                    >{{ row.line.name }}</text>
                  </g>
                }
              </g>
            }
          }

          <!-- Stop circles + the cluster of badges/markers under them. The
               outer translate plants the group on the line geometry, then an
               inner scale(1/zoom) pins the visuals at constant screen size,
               same trick as the labels above. -->
          @for (row of networkLineRows(); track row.line.id) {
            @for (s of row.stops; track s.stop.id) {
              <g
                [attr.transform]="'translate(' + s.x + ',' + row.y + ') scale(' + invZoom() + ')'"
                class="stop-group"
                [class.route-dimmed]="hasRoute() && !isStopActiveOnLine(s.stop.id, row.line.id)"
                (click)="onStopClick(s.stop, $event)"
              >
                <title>{{ s.stop.name }}</title>
                <circle
                  [attr.r]="getStopRadius(s.stop.id, row)"
                  [attr.fill]="isInterchange(s.stop) ? 'white' : row.line.color"
                  [attr.stroke]="isInterchange(s.stop) ? '#333' : 'white'"
                  [attr.stroke-width]="isSingleLineMode() ? 3 : 2"
                  class="stop-circle"
                  [class.route-active]="hasRoute() && isStopActiveOnLine(s.stop.id, row.line.id)"
                  [class.route-transfer]="routeTransferIds().has(s.stop.id) && isStopActiveOnLine(s.stop.id, row.line.id)"
                />
                @if (isRowTerminus(s.stop.id, row)) {
                  <circle
                    [attr.r]="isSingleLineMode() ? 8 : 10"
                    [attr.fill]="isInterchange(s.stop) ? row.line.color : 'white'"
                  />
                }
                @if (isInterchange(s.stop) && !isRowTerminus(s.stop.id, row)) {
                  <circle
                    [attr.r]="isSingleLineMode() ? 5 : 6"
                    fill="#333"
                  />
                }

                <!-- Route markers: departure / arrival / transfer (only on relevant line row) -->
                @if (departureStopId() === s.stop.id && isStopActiveOnLine(s.stop.id, row.line.id)) {
                  <g class="route-marker route-marker-departure">
                    <circle [attr.r]="isSingleLineMode() ? 16 : 10" fill="#4caf50" opacity="0.9" />
                    <text text-anchor="middle" dominant-baseline="central" fill="white"
                          [attr.font-size]="isSingleLineMode() ? 12 : 8" font-weight="bold">D</text>
                  </g>
                } @else if (arrivalStopId() === s.stop.id && isStopActiveOnLine(s.stop.id, row.line.id)) {
                  <g class="route-marker route-marker-arrival">
                    <circle [attr.r]="isSingleLineMode() ? 16 : 10" fill="#f44336" opacity="0.9" />
                    <text text-anchor="middle" dominant-baseline="central" fill="white"
                          [attr.font-size]="isSingleLineMode() ? 12 : 8" font-weight="bold">A</text>
                  </g>
                } @else if (routeTransferIds().has(s.stop.id) && isStopActiveOnLine(s.stop.id, row.line.id)) {
                  <g class="route-marker route-marker-transfer">
                    <circle [attr.r]="isSingleLineMode() ? 12 : 8" fill="white" stroke="#333" stroke-width="1.5" />
                    <text text-anchor="middle" dominant-baseline="central" fill="#333"
                          [attr.font-size]="isSingleLineMode() ? 9 : 6" font-weight="bold">T</text>
                  </g>
                }

                <!-- Search highlight pulse -->
                @if (highlightedStopId() === s.stop.id) {
                  <circle class="search-highlight-ring" [attr.r]="isSingleLineMode() ? 20 : 14" />
                }

                <!-- Alert severity badge -->
                @if (!hasRoute() && alertSeverityMap().get(s.stop.id); as severity) {
                  <g [attr.transform]="'translate(' + getAlertOffset() + ',' + (-getAlertOffset()) + ')'"
                     [class]="'alert-badge alert-badge-' + severity.toLowerCase()">
                    <circle r="11" stroke="white" stroke-width="2.5" />
                    <text text-anchor="middle" dominant-baseline="central" fill="white"
                          font-size="14" font-weight="bold">!</text>
                  </g>
                }

                <!-- Badges for every hidden line passing through this stop —
                     no cap, every correspondence is shown. The grid wraps to a
                     new row every 4 columns. The dedicated class is what the
                     SVG export hooks into to strip the cluster cleanly. -->
                @if (!hasRoute() && hiddenLinesMap().get(s.stop.id); as hiddenCodes) {
                  <g class="hidden-lines-cluster"
                     [attr.transform]="'translate(0, ' + (isSingleLineMode() ? 28 : 30) + ')'">
                    @for (code of hiddenCodes; track code; let j = $index) {
                      <g [attr.transform]="getBadgeTransform(j, hiddenCodes.length)">
                        <circle r="16" [attr.fill]="getLineColor(code)" />
                        <text
                          text-anchor="middle"
                          dominant-baseline="central"
                          fill="white"
                          font-size="15"
                          font-weight="bold"
                        >{{ code }}</text>
                      </g>
                    }
                  </g>
                }
              </g>
            }
          }

          <!-- Labels (with zoom-aware LOD + collision pruning) -->
          @for (label of networkStopLabels(); track label.stop.id + ':' + label.lineId) {
            @if (isLabelRendered(label)) {
              <g [attr.transform]="'translate(' + label.x + ',' + label.y + ')'"
                 [class.route-dimmed]="hasRoute() && !isStopActiveOnLine(label.stop.id, label.lineId)">
                <title>{{ label.stop.name }}</title>
                <text
                  [attr.transform]="label.orientation === 'down' ? labelTransformDown() : labelTransformUp()"
                  class="stop-name"
                  [class.network-stop-name]="!isSingleLineMode()"
                  [class.interchange]="isInterchange(label.stop)"
                  [class.terminus]="isNetworkTerminus(label.stop)"
                >
                  {{ displayLabel(label.stop.name) }}
                </text>
              </g>
            }
          }
        </svg>

        <app-alert-overlay
          [networkAlerts]="alerts().networkAlerts"
          [lineAlerts]="visibleLineAlerts()"
        />

        <app-map-legend
          [hasHiddenLines]="hasHiddenLines()"
          [hasStopAlerts]="hasStopAlerts()"
        />

        <app-zoom-controls
          (zoomIn)="zoomIn()"
          (zoomOut)="zoomOut()"
          (resetView)="resetView()"
          (exportSvg)="exportSvg()"
        />

        @if (wheelHintVisible()) {
          <div class="wheel-hint" role="status" aria-live="polite">
            <kbd>Ctrl</kbd> + scroll to zoom
          </div>
        }
      </div>

      }
    </div>
  `,
  styleUrl: './schematic-map.component.scss'
})
export class SchematicMapComponent {
  lines = input.required<NetworkLine[]>();
  stops = input.required<LayoutStop[]>();
  lineColorMap = input.required<Map<string, string>>();
  visibleLineCodes = input.required<string[]>();
  alerts = input<NetworkMapAlerts>({ networkAlerts: [], lineAlerts: {}, stopAlerts: {} });
  routeResult = input<RouteResult | null>(null);
  departureStopId = input<string | null>(null);
  arrivalStopId = input<string | null>(null);
  highlightedStopId = input<string | null>(null);

  stopSelected = output<LayoutStop>();
  filterChange = output<string[]>();

  svgElement = viewChild<ElementRef<SVGSVGElement>>('svgElement');
  container = viewChild<ElementRef<HTMLDivElement>>('container');

  isPanning = signal(false);
  /** Shown once per browser the first time the user scrolls the wheel
   *  without Ctrl/Cmd, to teach the new "Ctrl + scroll = zoom" gesture. */
  wheelHintVisible = signal(false);
  private wheelHintTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly WHEEL_HINT_KEY = 'transit-hub.wheel-hint-seen';

  private readonly panZoom = new SvgPanZoom();
  private readonly NETWORK_PADDING = 80;
  /** Default canvas inner extent. Used as the lower bound for the
   *  horizontal axis and as the constant vertical extent — only the
   *  horizontal side grows for long lines. */
  private readonly DEFAULT_INNER_SIZE = 840;
  /** Minimum horizontal distance between two adjacent stops on a line.
   *  Below this, labels collide and the diagram becomes unreadable even
   *  with the constant-size LOD pruning. The diagram canvas grows
   *  horizontally to keep this guarantee. */
  private readonly MIN_STOP_SPACING = 50;
  private readonly rowLayout = inject(NetworkRowLayoutService);

  /** ?z=2.5 — current zoom factor. Cleared from the URL once the user
   *  is back at the default (zoom 1) so a clean view leaves a clean URL. */
  private readonly zoomParam = linkedQueryParam('z', {
    parse: (v: string | null): number | null => {
      if (v === null) {return null;}
      const n = parseFloat(v);
      return isFinite(n) && n > 0 ? n : null;
    },
    stringify: (v: number | null) => v === null ? null : v.toFixed(3).replace(/\.?0+$/, ''),
  });

  /** ?p=panX,panY — current pan offset in SVG units. Same clean-URL
   *  contract as zoomParam — omitted when at the diagram's natural origin. */
  private readonly panParam = linkedQueryParam('p', {
    parse: (v: string | null): { x: number; y: number } | null => {
      if (v === null) {return null;}
      const parts = v.split(',');
      if (parts.length !== 2) {return null;}
      const x = parseFloat(parts[0] ?? '');
      const y = parseFloat(parts[1] ?? '');
      return isFinite(x) && isFinite(y) ? { x, y } : null;
    },
    stringify: (v: { x: number; y: number } | null) =>
      v === null ? null : `${Math.round(v.x)},${Math.round(v.y)}`,
  });

  sortedLines = computed(() => {
    return [...this.lines()].sort((a, b) => {
      const typeA = a.code.replace(/[0-9]/g, '');
      const typeB = b.code.replace(/[0-9]/g, '');
      if (typeA !== typeB) {return typeA.localeCompare(typeB);}
      const numA = parseInt(a.code.replace(/[^0-9]/g, ''), 10) || 0;
      const numB = parseInt(b.code.replace(/[^0-9]/g, ''), 10) || 0;
      return numA - numB;
    });
  });

  /** O(1) lookup set derived from the input */
  visibleCodeSet = computed(() => new Set(this.visibleLineCodes()));

  /** Lines filtered to only those currently visible */
  visibleLines = computed(() => {
    const codes = this.visibleCodeSet();
    return this.sortedLines().filter(l => codes.has(l.code));
  });

  isSingleLineMode = computed(() => this.visibleLines().length === 1);

  /** Whether some lines are filtered out */
  hasHiddenLines = computed(() => this.visibleLineCodes().length < this.sortedLines().length);

  // --- Route overlay computed ---

  hasRoute = computed(() => this.routeResult() !== null);
  routeTransferIds = computed(() => new Set(this.routeResult()?.transferStopIds ?? []));

  /** Map<lineId, Set<edgeKey>> where edgeKey = "stopA|stopB" (sorted) */
  routeActiveEdges = computed(() => {
    const result = this.routeResult();
    if (!result) {return new Map<string, Set<string>>();}

    const map = new Map<string, Set<string>>();
    for (const segment of result.segments) {
      if (!map.has(segment.lineId)) {map.set(segment.lineId, new Set());}
      const edges = map.get(segment.lineId) ?? new Set<string>();
      for (let i = 0; i < segment.stopIds.length - 1; i++) {
        const a = segment.stopIds[i];
        const b = segment.stopIds[i + 1];
        if (a === undefined || b === undefined) {continue;}
        edges.add(a < b ? `${a}|${b}` : `${b}|${a}`);
      }
    }
    return map;
  });

  /** Map<lineId, Set<stopId>> — stops that touch an active edge on that line */
  routeStopsByLine = computed(() => {
    const result = this.routeResult();
    if (!result) {return new Map<string, Set<string>>();}

    const map = new Map<string, Set<string>>();
    for (const segment of result.segments) {
      if (!map.has(segment.lineId)) {map.set(segment.lineId, new Set());}
      const stops = map.get(segment.lineId) ?? new Set<string>();
      for (const id of segment.stopIds) {
        stops.add(id);
      }
    }
    return map;
  });

  /** For each visible line row, build a path covering only the route edges */
  routeOverlayPaths = computed(() => {
    const activeEdges = this.routeActiveEdges();
    const rows = this.networkLineRows();
    const result: { lineId: string; color: string; path: string }[] = [];

    for (const row of rows) {
      const lineEdges = activeEdges.get(row.line.id);
      if (!lineEdges || lineEdges.size === 0) {continue;}

      // Find consecutive segments of active edges in this row
      let pathD = '';
      let inSegment = false;

      for (let i = 0; i < row.stops.length - 1; i++) {
        const curr = row.stops[i];
        const next = row.stops[i + 1];
        if (!curr || !next) {continue;}
        const a = curr.stop.id;
        const b = next.stop.id;
        const key = a < b ? `${a}|${b}` : `${b}|${a}`;

        if (lineEdges.has(key)) {
          if (!inSegment) {
            pathD += `M ${curr.x},${row.y} `;
            inSegment = true;
          }
          pathD += `L ${next.x},${row.y} `;
        } else {
          inSegment = false;
        }
      }

      if (pathD) {
        result.push({ lineId: row.line.id, color: row.line.color, path: pathD.trim() });
      }
    }

    return result;
  });

  /** Direction arrows placed along each route segment */
  routeDirectionArrows = computed(() => {
    const result = this.routeResult();
    if (!result) {return [];}

    const rows = this.networkLineRows();
    const rowByLine = new Map(rows.map(r => [r.line.id, r]));
    const arrows: { x: number; y: number; right: boolean; color: string }[] = [];
    const ARROW_INTERVAL = 120;

    for (const segment of result.segments) {
      const row = rowByLine.get(segment.lineId);
      if (!row || segment.stopIds.length < 2) {continue;}

      const stopXMap = new Map(row.stops.map(s => [s.stop.id, s.x]));
      const firstStopId = segment.stopIds[0];
      const lastStopId = segment.stopIds[segment.stopIds.length - 1];
      if (!firstStopId || !lastStopId) {continue;}
      const firstX = stopXMap.get(firstStopId);
      const lastX = stopXMap.get(lastStopId);
      if (firstX === undefined || lastX === undefined) {continue;}

      const right = lastX > firstX;
      const minX = Math.min(firstX, lastX);
      const maxX = Math.max(firstX, lastX);
      const span = maxX - minX;

      // Place arrows at regular intervals, at least one at the midpoint
      const count = Math.max(1, Math.floor(span / ARROW_INTERVAL));
      for (let i = 0; i < count; i++) {
        const t = (i + 1) / (count + 1);
        arrows.push({ x: minX + span * t, y: row.y, right, color: segment.lineColor });
      }
    }

    return arrows;
  });

  stopsMap = computed(() => {
    const map = new Map<string, LayoutStop>();
    for (const stop of this.stops()) {
      map.set(stop.id, stop);
    }
    return map;
  });

  /** ViewBox that tightly wraps the visible content with margins for labels/badges */
  baseViewBox = computed(() => {
    const rows = this.networkLineRows();
    if (rows.length === 0) {
      return { x: 0, y: 0, w: 1000, h: 600 };
    }

    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;

    for (const row of rows) {
      minY = Math.min(minY, row.y);
      maxY = Math.max(maxY, row.y);
      for (const s of row.stops) {
        minX = Math.min(minX, s.x);
        maxX = Math.max(maxX, s.x);
      }
    }

    const sideMargin = 80;
    // Rotated labels span ~150 SVG units along their axis for the longest French
    // stop names. We reserve that on every side that can host them: top is always
    // populated by upward labels; bottom now also receives the bottom row's
    // downward labels in multi-line, plus alternating downward labels in single-line.
    const topMargin = 160;
    const bottomMargin = 160;

    const contentW = Math.max((maxX - minX) + sideMargin * 2, 200);
    const w = contentW / 0.6;  // content occupies ~60% of the view width
    const extraSide = (w - contentW) / 2;

    const x = minX - sideMargin - extraSide;
    const y = minY - topMargin;
    const h = Math.max((maxY - minY) + topMargin + bottomMargin, 200);

    return { x, y, w, h };
  });

  currentViewBox = signal('0 0 800 220');

  /** Effective zoom level: 1 = base view, 2 = zoomed-in 2x. Drives
   *  level-of-detail decisions (which labels are worth showing) so the
   *  full-network view stays readable at low zoom and reveals more as
   *  the user zooms in. */
  zoomLevel = computed(() => {
    const parts = this.currentViewBox().split(' ').map(parseFloat);
    const curW = parts[2];
    const baseW = this.baseViewBox().w;
    if (!curW || curW <= 0 || !baseW) {return 1;}
    return baseW / curW;
  });

  /** Live size of the SVG element on screen, refreshed by a ResizeObserver
   *  in the constructor. Drives the screen-space compensation below. */
  private readonly svgRect = signal<{ w: number; h: number }>({ w: 0, h: 0 });

  /** Natural svg-unit-to-screen-px ratio at zoom 1. Single-line is wider
   *  than tall so the SVG ends up width-constrained (~0.7 px per unit);
   *  dense multi-line views are taller and become height-constrained
   *  (~0.5 px per unit), which is why icons used to feel smaller as the
   *  number of rows grew. */
  private readonly baseScale = computed(() => {
    const r = this.svgRect();
    const vb = this.baseViewBox();
    if (r.w === 0 || r.h === 0 || vb.w === 0 || vb.h === 0) {return 1;}
    return Math.min(r.w / vb.w, r.h / vb.h);
  });

  /** Inverse total scale used by every "icon" (stop circles, hidden-line
   *  badges, alert/route markers, line code badges, route arrows, rotated
   *  labels). Compensates for both the user zoom AND the view-box-to-screen
   *  ratio, so an SVG-unit value of N gives N screen pixels regardless of
   *  how many rows are visible or how zoomed-in the user is. The line
   *  paths and stop positions keep scaling with zoom — only the visuals
   *  pinned with this factor stay at constant screen size. */
  invZoom = computed(() => {
    const total = this.baseScale() * this.zoomLevel();
    return total > 0 ? 1 / total : 1;
  });

  /** Transform strings for the rotated label, sharing the same inverse
   *  scale so a label keeps both its rendered font size and its offset
   *  from the stop in screen pixels. */
  labelTransformUp = computed(() => `rotate(-45) scale(${this.invZoom()}) translate(8, -8)`);
  labelTransformDown = computed(() => `rotate(45) scale(${this.invZoom()}) translate(8, 8)`);

  // --- Network computed (now always active, filtered by visibleLines) ---

  /** Horizontal extent of the diagram, expanded so every line gets at
   *  least MIN_STOP_SPACING units between adjacent stops. Falls back to
   *  the default 840 for short networks (≤ 18 stops on the longest line). */
  private readonly horizontalInnerSize = computed(() => {
    let maxStops = 0;
    for (const line of this.visibleLines()) {
      const len = line.itineraries[0]?.length ?? 0;
      if (len > maxStops) {maxStops = len;}
    }
    if (maxStops <= 1) {return this.DEFAULT_INNER_SIZE;}
    return Math.max(this.DEFAULT_INNER_SIZE, this.MIN_STOP_SPACING * (maxStops - 1));
  });

  /**
   * Per-line stop X positions. Each line stretches across the full width.
   * Interchange stops are fixed to a shared X (average of desired positions)
   * so that vertical connectors stay aligned across rows.
   */
  private readonly networkStopPositions = computed<Map<string, Map<string, number>>>(() => {
    return this.rowLayout.layout(this.visibleLines(), {
      padding: this.NETWORK_PADDING,
      size: this.horizontalInnerSize(),
    }).positions;
  });

  /** Each line as a horizontal row with its stops positioned across the full width */
  networkLineRows = computed<NetworkLineRow[]>(() => {
    const lines = this.visibleLines();
    const stopsMap = this.stopsMap();
    const posMap = this.networkStopPositions();

    const pad = this.NETWORK_PADDING;
    // Vertical axis stays at the default extent — only the horizontal
    // side grows for long lines. Stretching rows vertically would
    // disperse them needlessly when the network is dense.
    const verticalSize = this.DEFAULT_INNER_SIZE;
    const maxRowSpacing = 120;
    const rowSpacing = lines.length > 1 ? Math.min(maxRowSpacing, verticalSize / (lines.length - 1)) : 0;
    const totalHeight = (lines.length - 1) * rowSpacing;
    const baseY = pad + (verticalSize - totalHeight) / 2;

    return lines.map((line, idx) => {
      const y = baseY + idx * rowSpacing;
      const itinerary = line.itineraries[0] ?? [];
      const linePos = posMap.get(line.id);

      const stops = itinerary
        .map(id => {
          const stop = stopsMap.get(id);
          const x = linePos?.get(id);
          return stop && x !== undefined ? { stop, x } : null;
        })
        .filter((s): s is { stop: LayoutStop; x: number } => s !== null);

      let path = '';
      const firstStop = stops[0];
      if (stops.length >= 2 && firstStop) {
        path = `M ${firstStop.x},${y}`;
        for (let i = 1; i < stops.length; i++) {
          const s = stops[i];
          if (s) {
            path += ` L ${s.x},${y}`;
          }
        }
      }

      return { line, y, stops, path };
    });
  });

  /** Straight dashed connectors between rows for interchange stops. We
   *  track minY/maxY incrementally so a network with 50+ visible rows
   *  stays O(rows × stops) instead of paying an extra O(rows) spread on
   *  Math.min/max per interchange. */
  interchangeConnectors = computed<InterchangeConnector[]>(() => {
    const rows = this.networkLineRows();
    const positions = new Map<string, { name: string; x: number; minY: number; maxY: number; count: number }>();

    for (const row of rows) {
      for (const { stop, x } of row.stops) {
        const existing = positions.get(stop.id);
        if (existing) {
          if (row.y < existing.minY) {existing.minY = row.y;}
          if (row.y > existing.maxY) {existing.maxY = row.y;}
          existing.count++;
        } else {
          positions.set(stop.id, { name: stop.name, x, minY: row.y, maxY: row.y, count: 1 });
        }
      }
    }

    const result: InterchangeConnector[] = [];
    for (const [stopId, v] of positions) {
      if (v.count <= 1) {continue;}
      result.push({
        stopId,
        name: v.name,
        path: `M ${v.x},${v.minY} L ${v.x},${v.maxY}`,
      });
    }
    return result;
  });

  /** Labels for stops. All labels go up so the area below each stop is
   *  reserved for the hidden-line correspondence badges. Each stop gets a
   *  single label, anchored on the top-most row that hosts it. */
  networkStopLabels = computed<NetworkStopLabel[]>(() => {
    const rows = this.networkLineRows();
    const seen = new Set<string>();
    const labels: NetworkStopLabel[] = [];

    for (const row of rows) {
      for (const { stop, x } of row.stops) {
        if (seen.has(stop.id)) {continue;}
        seen.add(stop.id);
        labels.push({ stop, lineId: row.line.id, x, y: row.y, orientation: 'up' });
      }
    }

    return labels;
  });

  /** Greedy decluttering: drop labels that would overlap a higher-priority
   *  label already placed. Distance threshold scales inversely with zoom so
   *  it tracks pixel distance regardless of how zoomed-in the view is. */
  private readonly visibleLabelIds = computed(() => {
    const candidates = this.networkStopLabels().filter(l => this.isStopLabelVisible(l.stop));
    if (this.isSingleLineMode()) {
      return new Set(candidates.map(l => l.stop.id + ':' + l.lineId));
    }

    const ranked = [...candidates].sort((a, b) => this.labelPriority(b) - this.labelPriority(a));
    const baseGap = 60; // SVG units, corresponds to ~60px at zoom = 1
    const minDistSq = (baseGap / Math.max(0.5, this.zoomLevel())) ** 2;

    const accepted: NetworkStopLabel[] = [];
    const acceptedKeys = new Set<string>();

    for (const label of ranked) {
      const collides = accepted.some(other => {
        const dx = label.x - other.x;
        const dy = label.y - other.y;
        return dx * dx + dy * dy < minDistSq;
      });
      if (!collides) {
        accepted.push(label);
        acceptedKeys.add(label.stop.id + ':' + label.lineId);
      }
    }

    return acceptedKeys;
  });

  private labelPriority(label: NetworkStopLabel): number {
    const stop = label.stop;
    if (this.alertSeverityMap().has(stop.id)) {return 4;}
    if (this.isInterchange(stop) && this.isNetworkTerminus(stop)) {return 3;}
    if (this.isInterchange(stop)) {return 2;}
    if (this.isNetworkTerminus(stop)) {return 2;}
    return 1;
  }

  /** Precomputed map: stopId -> hidden line codes (lines not currently visible) */
  hiddenLinesMap = computed(() => {
    const visible = this.visibleCodeSet();
    const map = new Map<string, string[]>();
    for (const stop of this.stops()) {
      const hidden = stop.lineCodes.filter(code => !visible.has(code));
      if (hidden.length > 0) {
        map.set(stop.id, hidden);
      }
    }
    return map;
  });

  /** Precomputed map: stopId -> highest alert severity */
  alertSeverityMap = computed<Map<string, MessageSeverity>>(() => {
    const stopAlerts = this.alerts().stopAlerts;
    const map = new Map<string, MessageSeverity>();
    for (const [stopId, alerts] of Object.entries(stopAlerts)) {
      if (alerts.length === 0) {continue;}
      const max = alerts.reduce<MessageSeverity | null>((best, m) =>
        best === null || severityRank(m.severity) > severityRank(best) ? m.severity : best,
        null,
      );
      if (max) {map.set(stopId, max);}
    }
    return map;
  });

  /** Set of stop IDs that are terminus in at least one visible line's itinerary */
  private readonly networkTerminusIds = computed(() => {
    const ids = new Set<string>();
    for (const line of this.visibleLines()) {
      for (const itinerary of line.itineraries) {
        if (itinerary.length > 0) {
          const first = itinerary[0];
          const last = itinerary[itinerary.length - 1];
          if (first) {ids.add(first);}
          if (last) {ids.add(last);}
        }
      }
    }
    return ids;
  });

  /** A coarse-grained fingerprint of the current layout. The view is
   *  recentered only when this signature changes — a simple toggle in
   *  multi-line mode no longer wipes out the user's pan/zoom. */
  private readonly layoutSignature = computed(() => {
    const lines = this.visibleLines();
    if (lines.length === 0) {return 'empty';}
    const first = lines[0];
    if (lines.length === 1 && first) {return 'single:' + first.id;}
    return 'multi';
  });

  constructor() {
    // 1. URL → state. Re-applies whenever the user navigates with new ?z/?p
    //    values (back/forward, deep link, programmatic). The diff check
    //    breaks the loop with the URL-write side below.
    effect(() => {
      const z = this.zoomParam();
      const p = this.panParam();
      const targetZoom = z ?? 1;
      const targetPanX = p?.x ?? 0;
      const targetPanY = p?.y ?? 0;
      if (
        Math.abs(this.panZoom.zoom - targetZoom) > 1e-3 ||
        Math.abs(this.panZoom.panX - targetPanX) > 0.5 ||
        Math.abs(this.panZoom.panY - targetPanY) > 0.5
      ) {
        this.panZoom.setState(targetZoom, targetPanX, targetPanY);
        this.currentViewBox.set(this.panZoom.computeViewBox(this.baseViewBox()));
      }
    });

    // 2. Layout change → reset view, but only when the URL hasn't pinned
    //    an explicit zoom/pan (e.g. a shared deep-link must survive a
    //    filter-driven layout signature change).
    effect(() => {
      this.layoutSignature();
      if (this.zoomParam() === null && this.panParam() === null) {
        this.resetView();
      }
    });

    // 3. Track the SVG element's screen size so the icon-scaling formula
    //    can compensate for the view-box-to-screen ratio (different in
    //    single-line vs dense multi-line). Set up once after first render.
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      const svg = this.svgElement()?.nativeElement;
      if (!svg) {return;}
      const update = (): void => {
        const r = svg.getBoundingClientRect();
        this.svgRect.set({ w: r.width, h: r.height });
      };
      update();
      if (typeof ResizeObserver === 'undefined') {return;}
      const ro = new ResizeObserver(update);
      ro.observe(svg);
      destroyRef.onDestroy(() => ro.disconnect());
    });

    destroyRef.onDestroy(() => {
      if (this.wheelHintTimer) {clearTimeout(this.wheelHintTimer);}
    });
  }

  private maybeShowWheelHint(): void {
    try {
      if (localStorage.getItem(SchematicMapComponent.WHEEL_HINT_KEY)) {return;}
      localStorage.setItem(SchematicMapComponent.WHEEL_HINT_KEY, '1');
    } catch {
      // Private mode / disabled storage — show the hint once this session
      // and skip persistence rather than failing.
    }
    this.wheelHintVisible.set(true);
    if (this.wheelHintTimer) {clearTimeout(this.wheelHintTimer);}
    this.wheelHintTimer = setTimeout(() => {
      this.wheelHintVisible.set(false);
      this.wheelHintTimer = null;
    }, 3000);
  }

  // --- Filter methods ---

  toggleLine(code: string): void {
    const current = new Set(this.visibleCodeSet());
    if (current.has(code)) {
      current.delete(code);
    } else {
      current.add(code);
    }
    this.filterChange.emit([...current]);
  }

  toggleAllLines(): void {
    if (this.visibleLineCodes().length === this.sortedLines().length) {
      this.filterChange.emit([]);
    } else {
      this.filterChange.emit(this.sortedLines().map(l => l.code));
    }
  }

  showOnlyLine(code: string): void {
    this.filterChange.emit([code]);
  }

  /** Stroke width for line paths in SVG user units. Trunk modes (METRO,
   *  TRAM, TRAIN) get a heavier weight than buses so the structuring
   *  backbone of the network reads at a glance. */
  getLineStrokeWidth(line: NetworkLine): number {
    if (this.isSingleLineMode()) {return 8;}
    return this.isTrunkLine(line) ? 10 : 7;
  }

  getRouteStrokeWidth(lineId: string): number {
    if (this.isSingleLineMode()) {return 10;}
    const line = this.lines().find(l => l.id === lineId);
    return line && this.isTrunkLine(line) ? 13 : 10;
  }

  private isTrunkLine(line: NetworkLine): boolean {
    return line.type === 'TRAM' || line.type === 'METRO' || line.type === 'TRAIN';
  }

  // --- Stop helpers ---

  getStopRadius(stopId: string, row: NetworkLineRow): number {
    const terminus = this.isRowTerminus(stopId, row);
    if (this.isSingleLineMode()) {
      return terminus ? 14 : 12;
    }
    // Multi-line: scale-with-zoom, so values must already render at a
    // readable size at default zoom (~0.66 screen-px / SVG-unit).
    return terminus ? 18 : 14;
  }

  isNetworkTerminus(stop: LayoutStop): boolean {
    return this.networkTerminusIds().has(stop.id);
  }

  isRowTerminus(stopId: string, row: NetworkLineRow): boolean {
    const stops = row.stops;
    const first = stops[0];
    const last = stops[stops.length - 1];
    return stops.length > 0 && (first?.stop.id === stopId || last?.stop.id === stopId);
  }

  isInterchange(stop: LayoutStop): boolean {
    return stop.lineCodes.length > 1;
  }

  /** Level-of-detail filter (zoom-driven) for stop labels in multi-line mode.
   *  Always candidate: terminus, interchange, alerted stops.
   *  Other intermediate stops only become candidates once the user zooms in.
   *  Single-line mode keeps everything since rows are already focused. */
  isStopLabelVisible(stop: LayoutStop): boolean {
    if (this.isSingleLineMode()) {return true;}
    if (this.isInterchange(stop)) {return true;}
    if (this.isNetworkTerminus(stop)) {return true;}
    if (this.alertSeverityMap().has(stop.id)) {return true;}
    return this.zoomLevel() >= 1.4;
  }

  /** Final visibility after both LOD and collision-pruning passes */
  isLabelRendered(label: NetworkStopLabel): boolean {
    return this.visibleLabelIds().has(label.stop.id + ':' + label.lineId);
  }

  /** Whether a stop is part of the active route on a specific line */
  isStopActiveOnLine(stopId: string, lineId: string): boolean {
    return this.routeStopsByLine().get(lineId)?.has(stopId) ?? false;
  }

  getLineBadgeWidth(code: string): number {
    return Math.max(64, code.length * 14 + 24);
  }

  /** In multi-line views the row gap is too tight (120 SVG units) for the
   *  longest French stop names ("Saint-Martin-d'Hères, Paul Mistral"): rotated
   *  -45° they fan ~150 units along the diagonal and the text glyphs end up
   *  inside the stop circles of the row above. We drop the city prefix so the
   *  visible label fits in the row gap; the full name stays in the SVG
   *  <title> tooltip and in the stop popup. Single-line mode has plenty of
   *  vertical space, so it keeps the full name. */
  displayLabel(name: string): string {
    if (this.isSingleLineMode()) {return name;}
    const commaIdx = name.indexOf(',');
    if (commaIdx <= 0) {return name;}
    const tail = name.substring(commaIdx + 1).trim();
    return tail.length > 0 ? tail : name;
  }

  getLineColor(code: string): string {
    return this.lineColorMap().get(code) ?? '#666';
  }

  getTransportIcon(type: string): string {
    switch (type) {
      // Material Design "train" path (simplified, 18x18 viewBox)
      case 'TRAIN': return 'M12 2C8 2 4 2.5 4 6v9.5c0 1.93 1.57 3.5 3.5 3.5L6 20.5v.5h2l2-2h4l2 2h2v-.5L16.5 19c1.93 0 3.5-1.57 3.5-3.5V6c0-3.5-4-4-8-4zM7.5 17c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm3.5-7H6V6h5v4zm2 0V6h5v4h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
      // Material Design "tram" path
      case 'TRAM': return 'M13 5l.75-1.5H17V2H7v1.5h4.75L11 5C7.82 5.26 5 6.76 5 9v9c0 1.38.81 2.56 2 3.12V22c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h4v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-.88c1.19-.56 2-1.74 2-3.12V9c0-2.24-2.82-3.74-6-4zM7.5 19c-.83 0-1.5-.67-1.5-1.5S6.67 16 7.5 16s1.5.67 1.5 1.5S8.33 19 7.5 19zm3.5-7H7V9h4v3zm2 0V9h4v3h-4zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
      // Material Design "directions_bus" path
      case 'BUS': return 'M4 16c0 .88.39 1.67 1 2.22V20c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h8v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1.78c.61-.55 1-1.34 1-2.22V6c0-3.5-3.58-4-8-4s-8 .5-8 4v10zm3.5 1c-.83 0-1.5-.67-1.5-1.5S6.67 14 7.5 14s1.5.67 1.5 1.5S8.33 17 7.5 17zm9 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zm1.5-6H6V6h12v5z';
      // Material Design "subway" path
      case 'METRO': return 'M17.8 2.8C16 2.09 13.86 2 12 2c-1.86 0-4 .09-5.8.8C3.53 3.84 2 6.05 2 8.86V22h20V8.86c0-2.81-1.53-5.02-4.2-6.06zM7.5 18c-.83 0-1.5-.67-1.5-1.5S6.67 15 7.5 15s1.5.67 1.5 1.5S8.33 18 7.5 18zm3.5-7H6V8h5v3zm2 0V8h5v3h-5zm3.5 7c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z';
      default: return '';
    }
  }

  getAlertOffset(): number {
    return this.isSingleLineMode() ? 10 : 12;
  }

  hasStopAlerts(): boolean {
    return Object.keys(this.alerts().stopAlerts).length > 0;
  }

  /** lineId → highest severity for any active alert on that line */
  lineAlertSeverityMap = computed<Map<string, MessageSeverity>>(() => {
    const map = new Map<string, MessageSeverity>();
    for (const [lineId, messages] of Object.entries(this.alerts().lineAlerts)) {
      if (!messages.length) {continue;}
      const max = messages.reduce<MessageSeverity | null>((best, m) =>
        best === null || severityRank(m.severity) > severityRank(best) ? m.severity : best,
        null,
      );
      if (max) {map.set(lineId, max);}
    }
    return map;
  });

  visibleLineAlerts = computed<VisibleLineAlert[]>(() => {
    const lineAlerts = this.alerts().lineAlerts;
    const result: VisibleLineAlert[] = [];
    for (const line of this.visibleLines()) {
      const alerts = lineAlerts[line.id];
      if (alerts?.length) {result.push({ line, alerts });}
    }
    return result;
  });

  getBadgeTransform(index: number, total: number): string {
    const COLS = 4;
    const GAP = 36; // SVG units between hidden-line badges (sized for r=16)
    const col = index % COLS;
    const row = Math.floor(index / COLS);
    const colsInRow = row < Math.floor(total / COLS) ? COLS : total % COLS || COLS;
    const x = col * GAP - (colsInRow - 1) * GAP / 2;
    const y = row * GAP;
    return `translate(${x}, ${y})`;
  }

  onStopClick(stop: LayoutStop, event: Event): void {
    event.stopPropagation();
    this.stopSelected.emit(stop);
  }

  // --- Zoom / Pan ---

  zoomIn(): void {
    this.panZoom.zoomIn(this.baseViewBox());
    this.updateViewBox();
  }

  zoomOut(): void {
    this.panZoom.zoomOut(this.baseViewBox());
    this.updateViewBox();
  }

  resetView(): void {
    this.panZoom.reset();
    this.updateViewBox();
  }

  centerOnStop(stopId: string): void {
    let sx: number | null = null;
    let sy: number | null = null;
    for (const row of this.networkLineRows()) {
      for (const s of row.stops) {
        if (s.stop.id === stopId) {
          sx = s.x;
          sy = row.y;
          break;
        }
      }
      if (sx !== null) {break;}
    }
    if (sx === null || sy === null) {return;}

    this.panZoom.centerOn(sx, sy, this.baseViewBox());
    this.updateViewBox();
  }

  exportSvg(): void {
    const svgEl = this.svgElement()?.nativeElement;
    if (!svgEl) {return;}

    exportSvgToFile({
      svgElement: svgEl,
      baseViewBox: this.baseViewBox(),
      visibleLineCodes: this.visibleLineCodes(),
      allLineCodes: this.sortedLines().map(l => l.code),
    });
  }

  onWheel(event: WheelEvent): void {
    const svg = this.svgElement()?.nativeElement;
    if (!svg) {return;}
    const result = this.panZoom.onWheel(event, svg.getBoundingClientRect(), this.baseViewBox());
    this.updateViewBox();
    if (!result.zoomed) {this.maybeShowWheelHint();}
  }

  /** Keyboard navigation: arrows pan, +/- zoom, 0 reset. The wrapper has
   *  tabindex="0" so the user can Tab to it and pilot the diagram without
   *  a pointer. */
  onKeyDown(event: KeyboardEvent): void {
    const svg = this.svgElement()?.nativeElement;
    if (!svg) {return;}
    const rect = svg.getBoundingClientRect();
    const base = this.baseViewBox();
    const step = event.shiftKey ? 200 : 50;

    switch (event.key) {
      case 'ArrowLeft':  this.panZoom.panByScreenPx(-step, 0, base, rect); break;
      case 'ArrowRight': this.panZoom.panByScreenPx(step, 0, base, rect); break;
      case 'ArrowUp':    this.panZoom.panByScreenPx(0, -step, base, rect); break;
      case 'ArrowDown':  this.panZoom.panByScreenPx(0, step, base, rect); break;
      case '+':
      case '=':          this.panZoom.zoomIn(base); break;
      case '-':
      case '_':          this.panZoom.zoomOut(base); break;
      case '0':          this.panZoom.reset(); break;
      default: return;
    }
    event.preventDefault();
    this.updateViewBox();
  }

  onPointerDown(event: MouseEvent): void {
    if (this.panZoom.onPointerDown(event)) {
      this.isPanning.set(true);
    }
  }

  onPointerMove(event: MouseEvent): void {
    if (!this.panZoom.isDragging) {return;}
    const svg = this.svgElement()?.nativeElement;
    if (!svg) {return;}
    this.panZoom.onPointerMove(event, svg.getBoundingClientRect(), this.baseViewBox());
    this.updateViewBox();
  }

  onPointerUp(): void {
    this.panZoom.onPointerUp();
    this.isPanning.set(false);
  }

  onTouchStart(event: TouchEvent): void {
    this.panZoom.onTouchStart(event);
    if (event.touches.length === 1) {
      this.isPanning.set(true);
    }
  }

  onTouchMove(event: TouchEvent): void {
    const svg = this.svgElement()?.nativeElement;
    if (!svg) {return;}
    this.panZoom.onTouchMove(event, svg.getBoundingClientRect(), this.baseViewBox());
    this.updateViewBox();
  }

  private updateViewBox(): void {
    this.currentViewBox.set(this.panZoom.computeViewBox(this.baseViewBox()));
    this.syncStateToUrl();
  }

  /** Mirror the live pan/zoom into ?z and ?p, omitting them when the
   *  state has effectively returned to the default view. The ngxtension
   *  signal short-circuits when the value matches what's already there,
   *  so writing during a URL-driven update does not retrigger effects. */
  private syncStateToUrl(): void {
    const z = this.panZoom.zoom;
    const px = this.panZoom.panX;
    const py = this.panZoom.panY;

    this.zoomParam.set(Math.abs(z - 1) < 1e-3 ? null : z);
    this.panParam.set(Math.abs(px) < 0.5 && Math.abs(py) < 0.5 ? null : { x: px, y: py });
  }
}
