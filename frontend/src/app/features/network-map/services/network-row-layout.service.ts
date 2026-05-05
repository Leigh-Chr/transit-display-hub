import { Injectable } from '@angular/core';
import { NetworkLine } from '@shared/models';

export interface NetworkRowLayoutOptions {
  /** Inset on both sides of the canvas, in SVG units */
  padding: number;
  /** Inner span (canvas width − 2 × padding), in SVG units */
  size: number;
}

export interface NetworkRowLayoutResult {
  /** stopId positions per line: lineId → (stopId → x) */
  positions: Map<string, Map<string, number>>;
  /** Minimum spacing between interchange anchors actually used by the layout */
  minGap: number;
}

/**
 * Pure layout engine for the row-stacked network diagram.
 *
 * Produces an X position for every stop on every visible line so that:
 *  - each line is evenly spread across the canvas width by default,
 *  - interchange stops (those served by ≥ 2 lines) share a single X across
 *    all rows so the dashed vertical connectors line up,
 *  - interchanges keep a minimum spacing along each line to avoid overlaps,
 *  - intermediate stops between anchors are redistributed evenly.
 *
 * Has no Angular dependency on the rendering side and is safe to unit-test
 * in isolation.
 */
@Injectable({ providedIn: 'root' })
export class NetworkRowLayoutService {
  layout(lines: NetworkLine[], options: NetworkRowLayoutOptions): NetworkRowLayoutResult {
    const desired = this.computeDesiredPositions(lines, options.padding, options.size);
    const interchangeX = this.computeInterchangePositions(lines, desired);
    const minGap = this.enforceMinimumInterchangeSpacing(lines, interchangeX, options.size);
    const positions = this.pinAndRedistribute(lines, interchangeX, minGap, options.padding, options.size);
    return { positions, minGap };
  }

  /** Step 1: every stop gets a uniformly-spaced X across the line's row */
  private computeDesiredPositions(
    lines: NetworkLine[], pad: number, size: number,
  ): Map<string, Map<string, number>> {
    const desired = new Map<string, Map<string, number>>();
    for (const line of lines) {
      const it = line.itineraries[0] ?? [];
      if (it.length === 0) {continue;}
      const spacing = it.length > 1 ? size / (it.length - 1) : 0;
      const m = new Map<string, number>();
      it.forEach((id, i) => m.set(id, pad + i * spacing));
      desired.set(line.id, m);
    }
    return desired;
  }

  /** Step 2: interchange stops get the average X of their per-line desired positions */
  private computeInterchangePositions(
    lines: NetworkLine[], desired: Map<string, Map<string, number>>,
  ): Map<string, number> {
    const stopLineIds = new Map<string, string[]>();
    for (const line of lines) {
      for (const id of line.itineraries[0] ?? []) {
        if (!stopLineIds.has(id)) {stopLineIds.set(id, []);}
        stopLineIds.get(id)?.push(line.id);
      }
    }

    const interchangeX = new Map<string, number>();
    for (const [stopId, lineIds] of stopLineIds) {
      if (lineIds.length <= 1) {continue;}
      let sum = 0;
      for (const lid of lineIds) {sum += desired.get(lid)?.get(stopId) ?? 0;}
      interchangeX.set(stopId, sum / lineIds.length);
    }
    return interchangeX;
  }

  /** Step 2.5: shift interchange anchors so consecutive ones on the same line stay apart */
  private enforceMinimumInterchangeSpacing(
    lines: NetworkLine[], interchangeX: Map<string, number>, size: number,
  ): number {
    const maxStops = Math.max(...lines.map(l => (l.itineraries[0] ?? []).length), 1);
    const minGap = Math.max(40, size / (maxStops * 1.5));

    for (const line of lines) {
      const it = line.itineraries[0] ?? [];
      const ixInOrder = it.filter(id => interchangeX.has(id));
      if (ixInOrder.length < 2) {continue;}

      for (let i = 1; i < ixInOrder.length; i++) {
        const prevId = ixInOrder[i - 1];
        const curId = ixInOrder[i];
        if (!prevId || !curId) {continue;}
        const prevX = interchangeX.get(prevId);
        const curX = interchangeX.get(curId);
        if (prevX !== undefined && curX !== undefined && curX - prevX < minGap) {
          interchangeX.set(curId, prevX + minGap);
        }
      }
    }

    return minGap;
  }

  /** Step 3: per line, pin the edge + interchange stops and even-distribute the rest */
  private pinAndRedistribute(
    lines: NetworkLine[], interchangeX: Map<string, number>,
    minGap: number, pad: number, size: number,
  ): Map<string, Map<string, number>> {
    const result = new Map<string, Map<string, number>>();
    const leftX = pad;
    const rightX = pad + size;

    for (const line of lines) {
      const it = line.itineraries[0] ?? [];
      if (it.length === 0) {continue;}
      const lineMap = this.positionLineStops(it, interchangeX, minGap, leftX, rightX, size);
      result.set(line.id, lineMap);
    }

    return result;
  }

  private positionLineStops(
    itinerary: string[], interchangeX: Map<string, number>,
    minGap: number, leftX: number, rightX: number, size: number,
  ): Map<string, number> {
    const lineMap = new Map<string, number>();

    if (itinerary.length === 1) {
      const firstId = itinerary[0];
      if (firstId) {
        const ix = interchangeX.get(firstId);
        lineMap.set(firstId, ix ?? leftX + size / 2);
      }
      return lineMap;
    }

    const anchors: { idx: number; x: number }[] = [];

    const firstId = itinerary[0] ?? '';
    const firstIx = interchangeX.get(firstId);
    const firstX = firstIx ?? leftX;
    anchors.push({ idx: 0, x: firstX });
    lineMap.set(firstId, firstX);

    for (let i = 1; i < itinerary.length - 1; i++) {
      const stopId = itinerary[i];
      if (!stopId) {continue;}
      const ix = interchangeX.get(stopId);
      if (ix !== undefined) {
        const prev = anchors[anchors.length - 1];
        if (!prev) {continue;}
        const x = Math.max(ix, prev.x + minGap);
        anchors.push({ idx: i, x });
        lineMap.set(stopId, x);
      }
    }

    const lastId = itinerary[itinerary.length - 1] ?? '';
    const lastIx = interchangeX.get(lastId);
    const lastAnchor = anchors[anchors.length - 1];
    const lastX = lastIx !== undefined && lastAnchor ? Math.max(lastIx, lastAnchor.x + minGap) : rightX;
    anchors.push({ idx: itinerary.length - 1, x: lastX });
    lineMap.set(lastId, lastX);

    for (let a = 0; a < anchors.length - 1; a++) {
      const anchorA = anchors[a];
      const anchorB = anchors[a + 1];
      if (!anchorA || !anchorB) {continue;}
      this.distributeSegment(itinerary, anchorA.idx + 1, anchorB.idx, anchorA.x, anchorB.x, lineMap);
    }

    return lineMap;
  }

  private distributeSegment(
    itinerary: string[], fromIdx: number, toIdx: number,
    fromX: number, toX: number, out: Map<string, number>,
  ): void {
    const count = toIdx - fromIdx;
    if (count <= 0) {return;}
    const totalSlots = count + 1;
    const spacing = (toX - fromX) / totalSlots;
    for (let i = 0; i < count; i++) {
      const stopId = itinerary[fromIdx + i];
      if (stopId) {
        out.set(stopId, fromX + (i + 1) * spacing);
      }
    }
  }
}
