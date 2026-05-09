import { Injectable } from '@angular/core';
import { NetworkMap, NetworkLine, NetworkStop, NetworkTransfer } from '@shared/models';

class MinHeap<T> {
  private heap: T[] = [];

  constructor(private readonly compareFn: (a: T, b: T) => number) {}

  get size(): number {
    return this.heap.length;
  }

  push(item: T): void {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) {return undefined;}
    const top = this.heap[0];
    const last = this.heap.pop();
    if (this.heap.length > 0 && last !== undefined) {
      this.heap[0] = last;
      this.sinkDown(0);
    }
    return top;
  }

  private bubbleUp(i: number): void {
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const current = this.heap[i];
      const parentVal = this.heap[parent];
      if (current === undefined || parentVal === undefined || this.compareFn(current, parentVal) >= 0) {break;}
      this.heap[i] = parentVal;
      this.heap[parent] = current;
      i = parent;
    }
  }

  private sinkDown(i: number): void {
    const n = this.heap.length;
    for (;;) {
      let smallest = i;
      const left = 2 * i + 1;
      const right = 2 * i + 2;
      const smallestVal = this.heap[smallest];
      const leftVal = this.heap[left];
      const rightVal = this.heap[right];
      if (smallestVal !== undefined && left < n && leftVal !== undefined && this.compareFn(leftVal, smallestVal) < 0) {smallest = left;}
      const newSmallestVal = this.heap[smallest];
      if (newSmallestVal !== undefined && right < n && rightVal !== undefined && this.compareFn(rightVal, newSmallestVal) < 0) {smallest = right;}
      if (smallest === i) {break;}
      const iVal = this.heap[i];
      const sVal = this.heap[smallest];
      if (iVal !== undefined && sVal !== undefined) {
        this.heap[i] = sVal;
        this.heap[smallest] = iVal;
      }
      i = smallest;
    }
  }
}

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

interface GraphNode {
  stopId: string;
  lineId: string;
}

interface PqEntry {
  node: GraphNode;
  cost: number;
}

interface AdjacencyEdge {
  key: string;
  node: GraphNode;
  cost: number;
}

interface GraphBuildResult {
  adj: Map<string, AdjacencyEdge[]>;
  stopToLines: Map<string, Set<string>>;
}

export interface RouteFinderOptions {
  /** When true, prune stops whose `wheelchairBoarding` is
   *  `NOT_ACCESSIBLE`. Stops with `UNKNOWN` or `null` are kept —
   *  the spec defines them as "not declared", not "not accessible". */
  accessibleOnly?: boolean;
}

interface PathStep {
  stopId: string;
  lineId: string;
}

@Injectable({ providedIn: 'root' })
export class RouteFinderService {

  /** Default cost (seconds) applied to transfers not explicitly declared
   *  in transfers.txt. Calibrated against typical European urban metros:
   *  3 minutes of average wait + walk between platforms. The previous
   *  10000 magic number meant every interchange dwarfed the line-travel
   *  cost; routes through a single line, however indirect, always won. */
  private static readonly DEFAULT_TRANSFER_COST_SECONDS = 180;

  /** Type 3 in transfers.txt = transfer impossible. We materialise it as
   *  a near-infinite cost so any path containing it loses to alternatives. */
  private static readonly IMPOSSIBLE_TRANSFER_COST = 999_999;

  findRoute(
    networkMap: NetworkMap,
    fromStopId: string,
    toStopId: string,
    options?: RouteFinderOptions,
  ): RouteResult | null {
    if (fromStopId === toStopId) {return null;}

    const { adj, stopToLines } = this.buildGraph(networkMap, options);

    const startLines = stopToLines.get(fromStopId);
    if (!startLines || startLines.size === 0) {return null;}

    const targetLines = stopToLines.get(toStopId);
    if (!targetLines || targetLines.size === 0) {return null;}

    return this.runDijkstra(adj, startLines, targetLines, fromStopId, toStopId, networkMap);
  }

  /** Build adjacency graph with same-line edges and transfer edges. We walk
   *  every itinerary of every line so branches, terminus-partial variants
   *  and reverse directions all contribute their adjacencies — otherwise a
   *  stop served only by a non-primary itinerary would be unreachable. */
  private buildGraph(networkMap: NetworkMap, options?: RouteFinderOptions): GraphBuildResult {
    const adj = new Map<string, AdjacencyEdge[]>();
    const stopToLines = new Map<string, Set<string>>();
    const seenEdges = new Set<string>();

    const blockedStopIds = options?.accessibleOnly
      ? this.collectInaccessibleStopIds(networkMap.stops)
      : new Set<string>();

    for (const line of networkMap.lines) {
      for (const itinerary of line.itineraries) {
        if (itinerary.length === 0) {continue;}
        const filtered = blockedStopIds.size > 0
          ? itinerary.filter(stopId => !blockedStopIds.has(stopId))
          : itinerary;
        if (filtered.length === 0) {continue;}
        this.registerStopLineAssociations(filtered, line.id, stopToLines);
        this.addSameLineEdges(filtered, line.id, adj, seenEdges);
      }
    }

    const transferIndex = this.indexTransfers(networkMap.transfers ?? []);
    this.addTransferEdges(stopToLines, adj, transferIndex);

    return { adj, stopToLines };
  }

  /** Set of stop ids whose wheelchair_boarding is explicitly
   *  NOT_ACCESSIBLE. UNKNOWN / null stops are kept — the spec defines
   *  them as "not declared", not "not accessible", so excluding them
   *  would over-prune feeds that don't ship the field. */
  private collectInaccessibleStopIds(stops: NetworkStop[]): Set<string> {
    const blocked = new Set<string>();
    for (const stop of stops) {
      if (stop.wheelchairBoarding === 'NOT_ACCESSIBLE') {
        blocked.add(stop.id);
      }
    }
    return blocked;
  }

  /** Builds a lookup from "fromStopId|toStopId" to the most-favourable
   *  declared transfer. Both directions are indexed so transfers.txt's
   *  one-way semantics still let the route-finder find the cheap path
   *  in either travel direction. */
  private indexTransfers(transfers: NetworkTransfer[]): Map<string, NetworkTransfer> {
    const index = new Map<string, NetworkTransfer>();
    for (const t of transfers) {
      const fwdKey = `${t.fromStopId}|${t.toStopId}`;
      const revKey = `${t.toStopId}|${t.fromStopId}`;
      // Prefer the cheaper transfer when multiple rows describe the
      // same pair (rare but happens in feeds with both directional and
      // generic entries).
      const existing = index.get(fwdKey);
      if (!existing || this.transferCostFor(t) < this.transferCostFor(existing)) {
        index.set(fwdKey, t);
        index.set(revKey, t);
      }
    }
    return index;
  }

  /** Resolves the Dijkstra cost for a declared transfer. Type 3 = not
   *  possible (effectively pruned), type 1 = timed (synced services,
   *  near-zero), others fall back to {@code minTransferTimeSeconds} or
   *  the global default. */
  private transferCostFor(transfer: NetworkTransfer): number {
    switch (transfer.transferType) {
      case 3: return RouteFinderService.IMPOSSIBLE_TRANSFER_COST;
      case 1: return transfer.minTransferTimeSeconds ?? 0;
      default: return transfer.minTransferTimeSeconds ?? RouteFinderService.DEFAULT_TRANSFER_COST_SECONDS;
    }
  }

  /** Register which lines serve each stop */
  private registerStopLineAssociations(
    itinerary: string[], lineId: string, stopToLines: Map<string, Set<string>>
  ): void {
    for (const stopId of itinerary) {
      if (!stopToLines.has(stopId)) {stopToLines.set(stopId, new Set());}
      stopToLines.get(stopId)?.add(lineId);
    }
  }

  /** Add bidirectional edges between consecutive stops on the same line
   *  (cost 1). The seen set deduplicates edges across itineraries: a forward
   *  and a reverse direction of the same line would otherwise add every
   *  segment twice. */
  private addSameLineEdges(
    itinerary: string[], lineId: string, adj: Map<string, AdjacencyEdge[]>,
    seen: Set<string>,
  ): void {
    for (let i = 0; i < itinerary.length - 1; i++) {
      const a = itinerary[i];
      const b = itinerary[i + 1];
      if (a === undefined || b === undefined || a === b) {continue;}

      const canonical = a < b ? `${a}|${b}|${lineId}` : `${b}|${a}|${lineId}`;
      if (seen.has(canonical)) {continue;}
      seen.add(canonical);

      const keyA = this.getKey(a, lineId);
      const keyB = this.getKey(b, lineId);

      this.addEdge(adj, keyA, keyB, { stopId: b, lineId }, 1);
      this.addEdge(adj, keyB, keyA, { stopId: a, lineId }, 1);
    }
  }

  /** Add transfer edges between different lines at the same stop. The
   *  cost is the declared transfers.txt minimum-time when present, with
   *  a sensible default otherwise. */
  private addTransferEdges(
    stopToLines: Map<string, Set<string>>,
    adj: Map<string, AdjacencyEdge[]>,
    transferIndex: Map<string, NetworkTransfer>,
  ): void {
    for (const [stopId, lineIds] of stopToLines) {
      const lines = [...lineIds];
      const selfTransfer = transferIndex.get(`${stopId}|${stopId}`);
      const cost = selfTransfer
        ? this.transferCostFor(selfTransfer)
        : RouteFinderService.DEFAULT_TRANSFER_COST_SECONDS;
      // Skip building edges for transfers explicitly marked impossible.
      if (cost >= RouteFinderService.IMPOSSIBLE_TRANSFER_COST) {continue;}

      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const lineI = lines[i];
          const lineJ = lines[j];
          if (lineI === undefined || lineJ === undefined) {continue;}

          const keyA = this.getKey(stopId, lineI);
          const keyB = this.getKey(stopId, lineJ);

          this.addEdge(adj, keyA, keyB, { stopId, lineId: lineJ }, cost);
          this.addEdge(adj, keyB, keyA, { stopId, lineId: lineI }, cost);
        }
      }
    }
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
      const key = this.getKey(fromStopId, lineId);
      dist.set(key, 0);
      prev.set(key, null);
      pq.push({ node: { stopId: fromStopId, lineId }, cost: 0 });
    }

    const targetKeys = new Set([...targetLines].map(lid => this.getKey(toStopId, lid)));

    while (pq.size > 0) {
      const popped = pq.pop();
      if (!popped) {break;}
      const { node, cost } = popped;
      const key = this.getKey(node.stopId, node.lineId);

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

  private getKey(stopId: string, lineId: string): string {
    return `${stopId}|${lineId}`;
  }

  private addEdge(
    adj: Map<string, AdjacencyEdge[]>, fromKey: string, toKey: string, toNode: GraphNode, cost: number
  ): void {
    if (!adj.has(fromKey)) {adj.set(fromKey, []);}
    adj.get(fromKey)?.push({ key: toKey, node: toNode, cost });
  }
}
