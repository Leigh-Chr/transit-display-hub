import { TranslocoService } from '@jsverse/transloco';
import { Pathway, PathwayMode } from '@shared/models';

/**
 * Pure helpers that lay out the pathways admin SVG graph. Extracted
 * from `pathways.component.ts` so the BFS + geometry math is testable
 * in isolation (no TestBed, no Transloco wiring) and the component
 * itself stays focused on Angular concerns (signals, dialogs, forms).
 *
 * <p>Layout rule: BFS from {@code rootStopId}, column = depth, row =
 * arrival order within that depth. Unreachable stops are placed in
 * trailing columns so their incident pathways still render.
 */

interface PathwayGraphNode {
  id: string;
  name: string;
  shortName: string;
  x: number;
  y: number;
  isCurrent: boolean;
}

interface PathwayGraphEdge {
  key: string;
  x1: number; y1: number;
  x2: number; y2: number;
  /** CSS class such as `pathway-mode-stairs` whose stroke/fill is resolved
   *  through the design-system tokens in pathways.component.scss. */
  modeClass: string;
  strokeWidth: number;
  dash: string | null;
  bidirectional: boolean;
  arrowPoints: string;
  tooltip: string;
}

interface PathwayGraphLegendEntry {
  mode: PathwayMode;
  label: string;
  /** CSS class such as `pathway-mode-stairs` whose background is resolved
   *  through the design-system tokens in pathways.component.scss. */
  modeClass: string;
  dashed: boolean;
}

export interface PathwayGraphLayout {
  nodes: PathwayGraphNode[];
  edges: PathwayGraphEdge[];
  legend: PathwayGraphLegendEntry[];
  viewBox: string;
}

/**
 * Per-mode CSS class — the actual colour comes from
 * pathways.component.scss, which maps each class to the matching
 * semantic token (`var(--mat-sys-outline)` for walkways,
 * `var(--app-critical)` for stairs, …). Keeping the lookup as a
 * class name means a dark-theme switch or a design-system token
 * change automatically propagates without touching this TypeScript.
 */
const PATHWAY_MODE_CLASS: Record<PathwayMode, string> = {
  WALKWAY: 'pathway-mode-walkway',
  STAIRS: 'pathway-mode-stairs',
  MOVING_SIDEWALK: 'pathway-mode-moving-sidewalk',
  ESCALATOR: 'pathway-mode-escalator',
  ELEVATOR: 'pathway-mode-elevator',
  FARE_GATE: 'pathway-mode-fare-gate',
  EXIT_GATE: 'pathway-mode-exit-gate',
};

/**
 * Build the SVG layout for the pathways graph anchored at {@code rootStopId}.
 * {@code transloco} is optional so unit tests can call this helper
 * without wiring a Transloco TestBed — the legend label falls back to
 * the raw enum when omitted.
 */
export function buildPathwayGraphLayout(
  pathways: Pathway[],
  rootStopId: string,
  transloco?: TranslocoService,
): PathwayGraphLayout {
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
      shortName: shortenName(name),
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

    const modeClass = PATHWAY_MODE_CLASS[p.pathwayMode];
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
        : arrowPolygon(from.x, from.y, to.x, to.y, 12, 6);

    edges.push({
      key: canonical,
      x1: from.x, y1: from.y,
      x2: to.x, y2: to.y,
      modeClass,
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
      label: modeLabelStatic(mode, transloco),
      modeClass: PATHWAY_MODE_CLASS[mode],
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

/**
 * Compact display name — keeps SVG labels readable on small graphs.
 * Picks the part after the last separator (em-dash, hyphen, slash)
 * when the name is long.
 */
function shortenName(name: string): string {
  if (name.length <= 18) {return name;}
  const sep = / [—\-/]\s+/;
  const parts = name.split(sep);
  const last = parts[parts.length - 1];
  if (last !== undefined && last.length > 0 && last.length <= 18) {
    return last;
  }
  return name.slice(0, 17) + '…';
}

function modeLabelStatic(mode: PathwayMode, transloco?: TranslocoService): string {
  return transloco ? transloco.translate(`map.transit.pathwayMode.${mode}`) : mode;
}

/**
 * Build a triangle polygon pointing from (x1,y1) toward (x2,y2),
 * with the tip placed at distance {@code tipBack} before the target
 * to avoid overlapping the destination circle.
 */
function arrowPolygon(
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
