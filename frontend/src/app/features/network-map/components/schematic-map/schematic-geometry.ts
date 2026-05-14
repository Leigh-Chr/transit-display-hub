import { MessageSeverity, NetworkLine } from '@shared/models';
import { LayoutStop } from '../../services/schematic-layout.service';
import { RouteResult } from '../../services/route-finder.service';
import { severityRank } from './schematic-map.utils';

/** One schematic row: a line laid out horizontally with its stops
 *  positioned across the full canvas width, plus the SVG path that
 *  draws the line itself. */
export interface NetworkLineRow {
  line: NetworkLine;
  y: number;
  stops: { stop: LayoutStop; x: number }[];
  path: string;
}

/** A straight vertical connector drawn between the topmost and
 *  bottommost row that hosts a shared interchange stop. */
export interface InterchangeConnector {
  stopId: string;
  name: string;
  /** SVG path data for the vertical line between the two rows. */
  path: string;
}

/** A single stop label anchored on the top-most row that hosts the
 *  stop. */
export interface NetworkStopLabel {
  stop: LayoutStop;
  lineId: string;
  x: number;
  y: number;
  /** Whether the rotated label fans up-right (above the row) or
   *  down-right (below). */
  orientation: 'up' | 'down';
}

// --- Route overlay ---------------------------------------------------------

/** Map&lt;lineId, Set&lt;edgeKey&gt;&gt; where edgeKey = "stopA|stopB" (sorted). */
export function buildRouteActiveEdges(result: RouteResult | null): Map<string, Set<string>> {
  if (!result) { return new Map<string, Set<string>>(); }

  const map = new Map<string, Set<string>>();
  for (const segment of result.segments) {
    if (!map.has(segment.lineId)) { map.set(segment.lineId, new Set()); }
    const edges = map.get(segment.lineId) ?? new Set<string>();
    for (let i = 0; i < segment.stopIds.length - 1; i++) {
      const a = segment.stopIds[i];
      const b = segment.stopIds[i + 1];
      if (a === undefined || b === undefined) { continue; }
      edges.add(a < b ? `${a}|${b}` : `${b}|${a}`);
    }
  }
  return map;
}

/** Map&lt;lineId, Set&lt;stopId&gt;&gt; — stops that touch an active edge on
 *  that line. */
export function buildRouteStopsByLine(result: RouteResult | null): Map<string, Set<string>> {
  if (!result) { return new Map<string, Set<string>>(); }

  const map = new Map<string, Set<string>>();
  for (const segment of result.segments) {
    if (!map.has(segment.lineId)) { map.set(segment.lineId, new Set()); }
    const stops = map.get(segment.lineId) ?? new Set<string>();
    for (const id of segment.stopIds) {
      stops.add(id);
    }
  }
  return map;
}

/** For each visible line row, build a path covering only the route
 *  edges that are active on that line. */
export function buildRouteOverlayPaths(
  activeEdges: Map<string, Set<string>>,
  rows: NetworkLineRow[],
): { lineId: string; color: string; path: string }[] {
  const result: { lineId: string; color: string; path: string }[] = [];

  for (const row of rows) {
    const lineEdges = activeEdges.get(row.line.id);
    if (!lineEdges || lineEdges.size === 0) { continue; }

    let pathD = '';
    let inSegment = false;

    for (let i = 0; i < row.stops.length - 1; i++) {
      const curr = row.stops[i];
      const next = row.stops[i + 1];
      if (!curr || !next) { continue; }
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
}

/** Direction arrows placed at regular intervals along each route
 *  segment, at least one at the midpoint. */
export function buildRouteDirectionArrows(
  result: RouteResult | null,
  rows: NetworkLineRow[],
): { x: number; y: number; right: boolean; color: string }[] {
  if (!result) { return []; }

  const rowByLine = new Map(rows.map(r => [r.line.id, r]));
  const arrows: { x: number; y: number; right: boolean; color: string }[] = [];
  const ARROW_INTERVAL = 120;

  for (const segment of result.segments) {
    const row = rowByLine.get(segment.lineId);
    if (!row || segment.stopIds.length < 2) { continue; }

    const stopXMap = new Map(row.stops.map(s => [s.stop.id, s.x]));
    const firstStopId = segment.stopIds[0];
    const lastStopId = segment.stopIds[segment.stopIds.length - 1];
    if (!firstStopId || !lastStopId) { continue; }
    const firstX = stopXMap.get(firstStopId);
    const lastX = stopXMap.get(lastStopId);
    if (firstX === undefined || lastX === undefined) { continue; }

    const right = lastX > firstX;
    const minX = Math.min(firstX, lastX);
    const maxX = Math.max(firstX, lastX);
    const span = maxX - minX;

    const count = Math.max(1, Math.floor(span / ARROW_INTERVAL));
    for (let i = 0; i < count; i++) {
      const t = (i + 1) / (count + 1);
      arrows.push({ x: minX + span * t, y: row.y, right, color: segment.lineColor });
    }
  }

  return arrows;
}

// --- Layout geometry -------------------------------------------------------

/** Straight dashed connectors between rows for interchange stops.
 *  minY/maxY are tracked incrementally so a network with 50+ visible
 *  rows stays O(rows × stops). */
export function buildInterchangeConnectors(rows: NetworkLineRow[]): InterchangeConnector[] {
  const positions = new Map<
    string,
    { name: string; x: number; minY: number; maxY: number; count: number }
  >();

  for (const row of rows) {
    for (const { stop, x } of row.stops) {
      const existing = positions.get(stop.id);
      if (existing) {
        if (row.y < existing.minY) { existing.minY = row.y; }
        if (row.y > existing.maxY) { existing.maxY = row.y; }
        existing.count++;
      } else {
        positions.set(stop.id, { name: stop.name, x, minY: row.y, maxY: row.y, count: 1 });
      }
    }
  }

  const result: InterchangeConnector[] = [];
  for (const [stopId, v] of positions) {
    if (v.count <= 1) { continue; }
    result.push({
      stopId,
      name: v.name,
      path: `M ${v.x},${v.minY} L ${v.x},${v.maxY}`,
    });
  }
  return result;
}

/** Labels for stops — one per stop, anchored on the top-most row that
 *  hosts it. All labels go up so the area below each stop stays free
 *  for the hidden-line correspondence badges. */
export function buildStopLabels(rows: NetworkLineRow[]): NetworkStopLabel[] {
  const seen = new Set<string>();
  const labels: NetworkStopLabel[] = [];

  for (const row of rows) {
    for (const { stop, x } of row.stops) {
      if (seen.has(stop.id)) { continue; }
      seen.add(stop.id);
      labels.push({ stop, lineId: row.line.id, x, y: row.y, orientation: 'up' });
    }
  }

  return labels;
}

/** key → highest alert severity across that key's active alerts.
 *  Drives both the stopId→severity and the lineId→severity maps,
 *  which share the same {@code Record<string, {severity}[]>} shape. */
export function buildSeverityMap(
  alertsByKey: Record<string, { severity: MessageSeverity }[]>,
): Map<string, MessageSeverity> {
  const map = new Map<string, MessageSeverity>();
  for (const [key, alerts] of Object.entries(alertsByKey)) {
    if (alerts.length === 0) { continue; }
    const max = alerts.reduce<MessageSeverity | null>(
      (best, m) =>
        best === null || severityRank(m.severity) > severityRank(best) ? m.severity : best,
      null,
    );
    if (max) { map.set(key, max); }
  }
  return map;
}

/** stopId → line codes that are not currently in the visible set. */
export function buildHiddenLinesMap(
  stops: LayoutStop[],
  visibleCodes: Set<string>,
): Map<string, string[]> {
  const map = new Map<string, string[]>();
  for (const stop of stops) {
    const hidden = stop.lineCodes.filter(code => !visibleCodes.has(code));
    if (hidden.length > 0) {
      map.set(stop.id, hidden);
    }
  }
  return map;
}

/** Set of stop IDs that are a terminus in at least one line's
 *  itinerary. */
export function buildTerminusIds(lines: NetworkLine[]): Set<string> {
  const ids = new Set<string>();
  for (const line of lines) {
    for (const itinerary of line.itineraries) {
      if (itinerary.length > 0) {
        const first = itinerary[0];
        const last = itinerary[itinerary.length - 1];
        if (first) { ids.add(first); }
        if (last) { ids.add(last); }
      }
    }
  }
  return ids;
}
