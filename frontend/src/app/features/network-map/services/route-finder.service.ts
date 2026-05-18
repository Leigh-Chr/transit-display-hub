import { Injectable, inject } from '@angular/core';
import { NetworkMap, NetworkLine } from '@shared/models';
import { MinHeap } from '@shared/utils/min-heap';
import {
  AdjacencyEdge,
  GraphBuildOptions,
  GraphNode,
  RouteGraphBuilder,
  nodeKey,
} from './route-graph-builder.service';

export interface RouteSegment {
  lineId: string;
  lineCode: string;
  lineColor: string;
  stopIds: string[];
  stopNames: string[];
  directionName: string;
}

export interface RouteResult {
  segments: RouteSegment[];
  transfers: number;
  transferStopIds: string[];
  allStopIds: string[];
}

interface PqEntry {
  node: GraphNode;
  cost: number;
}

interface PathStep {
  stopId: string;
  lineId: string;
}

/** Re-exported so call sites that already imported the options from
 *  this service do not have to chase the rename. */
export type RouteFinderOptions = GraphBuildOptions;

@Injectable({ providedIn: 'root' })
export class RouteFinderService {

  private readonly graphBuilder = inject(RouteGraphBuilder);

  findRoute(
    networkMap: NetworkMap,
    fromStopId: string,
    toStopId: string,
    options?: RouteFinderOptions,
  ): RouteResult | null {
    if (fromStopId === toStopId) {return null;}

    const { adj, stopToLines } = this.graphBuilder.build(networkMap, options);

    const startLines = stopToLines.get(fromStopId);
    if (!startLines || startLines.size === 0) {return null;}

    const targetLines = stopToLines.get(toStopId);
    if (!targetLines || targetLines.size === 0) {return null;}

    return this.runDijkstra(adj, startLines, targetLines, fromStopId, toStopId, networkMap);
  }

  /** Run Dijkstra's algorithm from all start lines to any target line */
  private runDijkstra(
    adj: Map<string, AdjacencyEdge[]>,
    startLines: Set<string>,
    targetLines: Set<string>,
    fromStopId: string,
    toStopId: string,
    networkMap: NetworkMap,
  ): RouteResult | null {
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();
    // Tie-break on lineId then stopId so two equally-cheap routes always
    // resolve to the same one. Without this, the heap order depends on
    // adjacency-map iteration order — re-importing GTFS in a different
    // sort could silently flip the chosen route between L1 and L2.
    const pq = new MinHeap<PqEntry>((a, b) => {
      if (a.cost !== b.cost) {return a.cost - b.cost;}
      if (a.node.lineId !== b.node.lineId) {return a.node.lineId < b.node.lineId ? -1 : 1;}
      if (a.node.stopId !== b.node.stopId) {return a.node.stopId < b.node.stopId ? -1 : 1;}
      return 0;
    });

    for (const lineId of startLines) {
      const key = nodeKey(fromStopId, lineId);
      dist.set(key, 0);
      prev.set(key, null);
      pq.push({ node: { stopId: fromStopId, lineId }, cost: 0 });
    }

    const targetKeys = new Set([...targetLines].map(lid => nodeKey(toStopId, lid)));

    while (pq.size > 0) {
      const popped = pq.pop();
      if (!popped) {break;}
      const { node, cost } = popped;
      const key = nodeKey(node.stopId, node.lineId);

      if (cost > (dist.get(key) ?? Infinity)) {continue;}

      if (targetKeys.has(key)) {
        return this.reconstructRoute(key, prev, networkMap);
      }

      for (const edge of (adj.get(key) ?? [])) {
        const newCost = cost + edge.cost;
        if (newCost < (dist.get(edge.key) ?? Infinity)) {
          dist.set(edge.key, newCost);
          prev.set(edge.key, key);
          pq.push({ node: edge.node, cost: newCost });
        }
      }
    }

    return null;
  }

  private reconstructRoute(
    endKey: string,
    prev: Map<string, string | null>,
    networkMap: NetworkMap,
  ): RouteResult {
    const path = this.tracePath(endKey, prev);
    const lineMap = this.buildLineMap(networkMap);
    const stopNameMap = this.buildStopNameMap(networkMap);

    const segments = this.groupPathIntoSegments(path, lineMap, stopNameMap);
    this.computeSegmentDirections(segments, lineMap, stopNameMap);

    const transferStopIds = this.extractTransferStopIds(segments);
    const allStopIds = this.collectAllStopIds(segments);

    return {
      segments,
      transfers: Math.max(0, segments.length - 1),
      transferStopIds,
      allStopIds,
    };
  }

  /** Trace the prev-map backwards from endKey to build the ordered path */
  private tracePath(endKey: string, prev: Map<string, string | null>): PathStep[] {
    const path: PathStep[] = [];
    let current: string | null = endKey;

    while (current !== null) {
      const parts = current.split('|');
      const stopId = parts[0] ?? '';
      const lineId = parts[1] ?? '';
      path.unshift({ stopId, lineId });
      current = prev.get(current) ?? null;
    }

    return path;
  }

  /** Build a lookup map of line ID to NetworkLine */
  private buildLineMap(networkMap: NetworkMap): Map<string, NetworkLine> {
    const lineMap = new Map<string, NetworkLine>();
    for (const line of networkMap.lines) {
      lineMap.set(line.id, line);
    }
    return lineMap;
  }

  /** Build a lookup map of stop ID to stop name */
  private buildStopNameMap(networkMap: NetworkMap): Map<string, string> {
    const stopNameMap = new Map<string, string>();
    for (const stop of networkMap.stops) {
      stopNameMap.set(stop.id, stop.name);
    }
    return stopNameMap;
  }

  /** Group consecutive path steps with the same lineId into RouteSegments */
  private groupPathIntoSegments(
    path: PathStep[],
    lineMap: Map<string, NetworkLine>,
    stopNameMap: Map<string, string>,
  ): RouteSegment[] {
    const segments: RouteSegment[] = [];
    let currentSegment: RouteSegment | null = null;

    for (const step of path) {
      if (currentSegment !== null && currentSegment.lineId === step.lineId) {
        currentSegment.stopIds.push(step.stopId);
        currentSegment.stopNames.push(stopNameMap.get(step.stopId) ?? '');
      } else {
        const line = lineMap.get(step.lineId);
        if (!line) {continue;}
        currentSegment = {
          lineId: step.lineId,
          lineCode: line.code,
          lineColor: line.color,
          stopIds: [step.stopId],
          stopNames: [stopNameMap.get(step.stopId) ?? ''],
          directionName: '',
        };
        segments.push(currentSegment);
      }
    }

    return segments;
  }

  /** Compute the direction name for each segment by picking the itinerary
   *  that actually matches the travelled segment. Using itineraries[0]
   *  blindly would mis-label routes through alternate branches or reverse
   *  directions. */
  private computeSegmentDirections(
    segments: RouteSegment[],
    lineMap: Map<string, NetworkLine>,
    stopNameMap: Map<string, string>,
  ): void {
    for (const segment of segments) {
      const line = lineMap.get(segment.lineId);
      if (!line) {continue;}
      const firstStopId = segment.stopIds[0] ?? '';
      const lastStopId = segment.stopIds[segment.stopIds.length - 1] ?? '';

      const itinerary = this.pickMatchingItinerary(line.itineraries, firstStopId, lastStopId);

      if (itinerary && itinerary.length >= 2 && segment.stopIds.length >= 2) {
        const firstIdx = itinerary.indexOf(firstStopId);
        const lastIdx = itinerary.indexOf(lastStopId);
        const terminusId = lastIdx > firstIdx
          ? (itinerary[itinerary.length - 1] ?? '')
          : (itinerary[0] ?? '');
        segment.directionName = stopNameMap.get(terminusId) ?? '';
      } else {
        segment.directionName = stopNameMap.get(lastStopId) ?? '';
      }
    }
  }

  /** Find the itinerary best describing the travelled segment. Prefers
   *  one where the segment endpoints appear in travel order; falls back
   *  to any itinerary containing both, then to the first itinerary. */
  private pickMatchingItinerary(
    itineraries: string[][],
    firstStopId: string,
    lastStopId: string,
  ): string[] | null {
    for (const itinerary of itineraries) {
      const firstIdx = itinerary.indexOf(firstStopId);
      const lastIdx = itinerary.indexOf(lastStopId);
      if (firstIdx >= 0 && lastIdx >= 0 && firstIdx < lastIdx) {
        return itinerary;
      }
    }
    for (const itinerary of itineraries) {
      const firstIdx = itinerary.indexOf(firstStopId);
      const lastIdx = itinerary.indexOf(lastStopId);
      if (firstIdx >= 0 && lastIdx >= 0) {
        return itinerary;
      }
    }
    return itineraries[0] ?? null;
  }

  /** Extract IDs of stops where a line transfer occurs */
  private extractTransferStopIds(segments: RouteSegment[]): string[] {
    const transferStopIds: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg) {continue;}
      const transferStop = seg.stopIds[0];
      if (transferStop !== undefined && !transferStopIds.includes(transferStop)) {
        transferStopIds.push(transferStop);
      }
    }
    return transferStopIds;
  }

  /** Build a deduplicated ordered list of all stop IDs across segments */
  private collectAllStopIds(segments: RouteSegment[]): string[] {
    const allStopIds: string[] = [];
    for (const segment of segments) {
      for (const stopId of segment.stopIds) {
        if (allStopIds.length === 0 || allStopIds[allStopIds.length - 1] !== stopId) {
          allStopIds.push(stopId);
        }
      }
    }
    return allStopIds;
  }
}
