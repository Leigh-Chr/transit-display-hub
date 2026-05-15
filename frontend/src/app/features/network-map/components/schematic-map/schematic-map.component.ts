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
import { NetworkLine, NetworkMapAlerts } from '@shared/models';
import { LayoutStop } from '../../services/schematic-layout.service';
import { NetworkRowLayoutService } from '../../services/network-row-layout.service';
import { RouteResult } from '../../services/route-finder.service';
import { SvgPanZoom } from '../../utils/svg-pan-zoom';
import { AlertOverlayComponent, VisibleLineAlert } from '../alert-overlay/alert-overlay.component';
import { LineFilterChipsComponent } from '../line-filter-chips/line-filter-chips.component';
import { MapLegendComponent } from '../map-legend/map-legend.component';
import { ZoomControlsComponent } from '../zoom-controls/zoom-controls.component';
import {
  hiddenLineBadgeTransform,
  lineBadgeWidth,
  getTransportIconPath,
  readableTextColor,
} from './schematic-map.utils';
import { LINE_COLOR_FALLBACK } from '@shared/utils/color.utils';
import {
  buildRouteActiveEdges,
  buildRouteStopsByLine,
  buildRouteOverlayPaths,
  buildRouteDirectionArrows,
  buildInterchangeConnectors,
  buildStopLabels,
  buildSeverityMap,
  buildHiddenLinesMap,
  buildTerminusIds,
  type InterchangeConnector,
  type NetworkLineRow,
  type NetworkStopLabel,
} from './schematic-geometry';

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
  templateUrl: './schematic-map.component.html',
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

  /** "Accessible only" filter: dims stops whose wheelchairBoarding is
   *  NOT_ACCESSIBLE or unknown. Doesn't rebuild the layout — the
   *  schematic structure stays stable, only the per-stop opacity
   *  changes — so toggling is fluid even on large networks. */
  accessibleOnly = signal(false);

  /** Single-select zone filter — null means "all zones". Same dim
   *  pattern as the accessibility filter: stops outside the selected
   *  zone fade rather than disappear so the line geometry stays
   *  intact. The chip row only renders when the feed actually ships
   *  Fares v2 areas, so passenger-bus-only feeds don't see a dead
   *  control. */
  selectedZone = signal<string | null>(null);

  /** Toggle a coloured halo behind every stop coloured by its
   *  primary fare zone. Orthogonal to {@link selectedZone}: the chip
   *  filter dims out-of-zone stops, the overlay paints in-zone stops.
   *  Off by default — adding a halo to every dot is visual noise on
   *  busy networks, so it stays opt-in. */
  zoneOverlayVisible = signal(false);

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
  /** Vertical pitch between two adjacent rows in multi-line mode. Fixed
   *  rather than compressed-to-fit so rotated stop labels and hidden-line
   *  badge clusters never bleed into the neighbouring row. */
  private readonly ROW_SPACING = 120;
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

  /** lineId → NetworkLine lookup. Avoids the O(n) `find` we'd otherwise
   *  do for every route segment when computing stroke widths. */
  private readonly lineById = computed(() => {
    const map = new Map<string, NetworkLine>();
    for (const line of this.lines()) {
      map.set(line.id, line);
    }
    return map;
  });

  /** Whether some lines are filtered out */
  hasHiddenLines = computed(() => this.visibleLineCodes().length < this.sortedLines().length);

  /** Highest schedule count across every loaded line. Anchors the
   *  log-scale that drives stroke-width, so a busy line in the
   *  current network always renders at the upper bound. */
  maxLineScheduleCount = computed<number>(() => {
    let max = 0;
    for (const line of this.lines()) {
      const count = line.scheduleCount ?? 0;
      if (count > max) {max = count;}
    }
    return max;
  });

  /** Sorted, deduped list of every Fares v2 zone the loaded stops
   *  reference. Drives the zone chip row; empty when the feed
   *  doesn't ship areas.txt. */
  availableZones = computed<string[]>(() => {
    const zones = new Set<string>();
    for (const stop of this.stops()) {
      for (const z of stop.fareAreaNames ?? []) {
        zones.add(z);
      }
    }
    return [...zones].sort();
  });

  // --- Route overlay computed ---

  hasRoute = computed(() => this.routeResult() !== null);
  routeTransferIds = computed(() => new Set(this.routeResult()?.transferStopIds ?? []));

  /** Map<lineId, Set<edgeKey>> where edgeKey = "stopA|stopB" (sorted) */
  routeActiveEdges = computed(() => buildRouteActiveEdges(this.routeResult()));

  /** Map<lineId, Set<stopId>> — stops that touch an active edge on that line */
  routeStopsByLine = computed(() => buildRouteStopsByLine(this.routeResult()));

  /** For each visible line row, build a path covering only the route edges */
  routeOverlayPaths = computed(() =>
    buildRouteOverlayPaths(this.routeActiveEdges(), this.networkLineRows()));

  /** Direction arrows placed along each route segment */
  routeDirectionArrows = computed(() =>
    buildRouteDirectionArrows(this.routeResult(), this.networkLineRows()));

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

    // When the visible rows have no stops at all (mid-filter transition,
    // category with empty rows), the min/max sentinels stay at ±Infinity
    // and would propagate as "Infinity" into the viewBox attribute. Fall
    // back to a sane default so the SVG keeps rendering.
    if (!Number.isFinite(minX) || !Number.isFinite(minY)) {
      return { x: 0, y: 0, w: 1000, h: 600 };
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
    const verticalSize = this.DEFAULT_INNER_SIZE;
    // Fixed row pitch: just enough for the rotated label of one row to
    // clear the correspondence cluster of the row above. Mirrors the
    // horizontal MIN_STOP_SPACING philosophy — we'd rather grow the
    // canvas than compress rows into an unreadable stripe.
    const rowSpacing = lines.length > 1 ? this.ROW_SPACING : 0;
    const totalHeight = (lines.length - 1) * rowSpacing;
    // Centre rows in the default canvas while they fit; once they don't,
    // pin them at the top padding and let the dynamic baseViewBox grow
    // to absorb the extra height.
    const baseY = totalHeight <= verticalSize
      ? pad + (verticalSize - totalHeight) / 2
      : pad;

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
  interchangeConnectors = computed<InterchangeConnector[]>(() =>
    buildInterchangeConnectors(this.networkLineRows()));

  /** Labels for stops. All labels go up so the area below each stop is
   *  reserved for the hidden-line correspondence badges. Each stop gets a
   *  single label, anchored on the top-most row that hosts it. */
  networkStopLabels = computed<NetworkStopLabel[]>(() =>
    buildStopLabels(this.networkLineRows()));

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
  hiddenLinesMap = computed(() => buildHiddenLinesMap(this.stops(), this.visibleCodeSet()));

  /** Precomputed map: stopId -> highest alert severity */
  alertSeverityMap = computed(() => buildSeverityMap(this.alerts().stopAlerts));

  /** Set of stop IDs that are terminus in at least one visible line's itinerary */
  private readonly networkTerminusIds = computed(() => buildTerminusIds(this.visibleLines()));

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
   *  backbone of the network reads at a glance. The frequency
   *  multiplier on top scales by relative {@code scheduleCount}
   *  within the visible set so a busy bus line and a sleepy metro
   *  line of similar volume read close in weight. */
  getLineStrokeWidth(line: NetworkLine): number {
    if (this.isSingleLineMode()) {return 8;}
    const base = this.isTrunkLine(line) ? 10 : 7;
    return Math.round(base * this.frequencyScaleFor(line));
  }

  getRouteStrokeWidth(lineId: string): number {
    if (this.isSingleLineMode()) {return 10;}
    const line = this.lineById().get(lineId);
    if (!line) {return 10;}
    const base = this.isTrunkLine(line) ? 13 : 10;
    return Math.round(base * this.frequencyScaleFor(line));
  }

  /** Multiplier in [0.75, 1.3] driven by the line's scheduleCount
   *  relative to the busiest line in the loaded network. Logarithmic
   *  rather than linear so a 100× volume difference doesn't blow up
   *  the high end into unreadable thicknesses. */
  private frequencyScaleFor(line: NetworkLine): number {
    const max = this.maxLineScheduleCount();
    if (max <= 0) {return 1;}
    const own = Math.max(0, line.scheduleCount ?? 0);
    if (own <= 0) {return 0.75;}
    const ratio = Math.log10(own + 1) / Math.log10(max + 1);
    return 0.75 + ratio * 0.55;
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

  /** Whether the stop counts as wheelchair-accessible for the
   *  "Accessible only" filter. Treats UNKNOWN as non-accessible —
   *  the operator may have left the field empty, but the
   *  passenger filter must err on the cautious side ("if I'm
   *  filtering for accessibility, only show me stops I'm sure
   *  about"). NOT_ACCESSIBLE is the explicit no. */
  isStopAccessible(stop: LayoutStop): boolean {
    return stop.wheelchairBoarding === 'ACCESSIBLE';
  }

  /** Whether the stop should be rendered at full opacity given the
   *  current zone filter. No zone selected = every stop passes. */
  isStopInSelectedZone(stop: LayoutStop): boolean {
    const target = this.selectedZone();
    if (!target) {return true;}
    return (stop.fareAreaNames ?? []).includes(target);
  }

  /** Halo colour for the zone-overlay layer. Returns null when the
   *  stop has no fare zones (e.g. a free-standing bus pole on a feed
   *  that ships areas only for the metro), so the template can skip
   *  the SVG circle entirely. Picks the alphabetically-first zone
   *  when a stop belongs to several — keeps the colour stable across
   *  re-renders without showing a striped artefact. */
  stopZoneColor(stop: LayoutStop): string | null {
    const zones = stop.fareAreaNames ?? [];
    if (zones.length === 0) {return null;}
    const sorted = [...zones].sort();
    const primary = sorted[0];
    if (primary === undefined) {return null;}
    return this.zoneColorFor(primary);
  }

  /** Deterministic HSL hue from a zone name. The hue spreads zones
   *  uniformly across the wheel; saturation 60 % + lightness 55 %
   *  keeps the halo visible against the schematic's white background
   *  without overpowering the line colours sitting on top.
   *  Exported so tests can pin the mapping. */
  zoneColorFor(zone: string): string {
    let hash = 0;
    for (let i = 0; i < zone.length; i++) {
      hash = (hash * 31 + zone.charCodeAt(i)) | 0;
    }
    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 60%, 55%)`;
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
    return lineBadgeWidth(code);
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
    return this.lineColorMap().get(code) ?? LINE_COLOR_FALLBACK;
  }

  /** Black or white text for a given line color, picked so it stays
   *  legible against pastel or saturated yellow/orange brand colors.
   *  When the server resolved a {@code textColor} (from GTFS
   *  {@code route_text_color} or its YIQ-derived fallback), prefer that
   *  value so admin overrides survive the round-trip. */
  getLineTextColor(bg: string, textColor?: string | null): string {
    return textColor ?? readableTextColor(bg);
  }

  getTransportIcon(type: string): string {
    return getTransportIconPath(type);
  }

  getAlertOffset(): number {
    return this.isSingleLineMode() ? 10 : 12;
  }

  hasStopAlerts(): boolean {
    return Object.keys(this.alerts().stopAlerts).length > 0;
  }

  /** lineId → highest severity for any active alert on that line */
  lineAlertSeverityMap = computed(() => buildSeverityMap(this.alerts().lineAlerts));

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
    return hiddenLineBadgeTransform(index, total);
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
