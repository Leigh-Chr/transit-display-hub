import { Injectable } from '@angular/core';
import { NetworkMap, NetworkLine } from '@shared/models';

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

@Injectable({ providedIn: 'root' })
export class RouteFinderService {

  findRoute(networkMap: NetworkMap, fromStopId: string, toStopId: string): RouteResult | null {
    if (fromStopId === toStopId) {return null;}

    // Build adjacency: key = "stopId|lineId", value = [{ neighbor key, cost }]
    const adj = new Map<string, { key: string; node: GraphNode; cost: number }[]>();

    const getKey = (stopId: string, lineId: string): string => `${stopId}|${lineId}`;

    const ensureNode = (key: string): void => {
      if (!adj.has(key)) {adj.set(key, []);}
    };

    const addEdge = (fromKey: string, toKey: string, toNode: GraphNode, cost: number): void => {
      ensureNode(fromKey);
      adj.get(fromKey)?.push({ key: toKey, node: toNode, cost });
    };

    // Track which lines serve each stop
    const stopToLines = new Map<string, Set<string>>();

    for (const line of networkMap.lines) {
      const itinerary = line.itineraries[0];
      if (!itinerary || itinerary.length === 0) {continue;}

      // Register stop-line associations
      for (const stopId of itinerary) {
        if (!stopToLines.has(stopId)) {stopToLines.set(stopId, new Set());}
        stopToLines.get(stopId)?.add(line.id);
      }

      // Same-line edges (cost 1) — bidirectional
      // Transfer edges will cost TRANSFER_COST, so transfers are heavily penalized
      // while still minimizing total stops as a tiebreaker
      for (let i = 0; i < itinerary.length - 1; i++) {
        const a = itinerary[i];
        const b = itinerary[i + 1];
        if (a === undefined || b === undefined) {continue;}
        const keyA = getKey(a, line.id);
        const keyB = getKey(b, line.id);
        const nodeA: GraphNode = { stopId: a, lineId: line.id };
        const nodeB: GraphNode = { stopId: b, lineId: line.id };

        addEdge(keyA, keyB, nodeB, 1);
        addEdge(keyB, keyA, nodeA, 1);
      }
    }

    // Transfer edges — same stop, different line
    const TRANSFER_COST = 10000;
    for (const [stopId, lineIds] of stopToLines) {
      const lines = [...lineIds];
      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const lineI = lines[i];
          const lineJ = lines[j];
          if (lineI === undefined || lineJ === undefined) {continue;}
          const keyA = getKey(stopId, lineI);
          const keyB = getKey(stopId, lineJ);
          const nodeA: GraphNode = { stopId, lineId: lineI };
          const nodeB: GraphNode = { stopId, lineId: lineJ };

          addEdge(keyA, keyB, nodeB, TRANSFER_COST);
          addEdge(keyB, keyA, nodeA, TRANSFER_COST);
        }
      }
    }

    // Dijkstra with binary min-heap priority queue
    const dist = new Map<string, number>();
    const prev = new Map<string, string | null>();

    const pq = new MinHeap<PqEntry>((a, b) => a.cost - b.cost);

    // Start from all lines at the departure stop
    const startLines = stopToLines.get(fromStopId);
    if (!startLines || startLines.size === 0) {return null;}

    for (const lineId of startLines) {
      const key = getKey(fromStopId, lineId);
      dist.set(key, 0);
      prev.set(key, null);
      pq.push({ node: { stopId: fromStopId, lineId }, cost: 0 });
    }

    // Target keys
    const targetLines = stopToLines.get(toStopId);
    if (!targetLines || targetLines.size === 0) {return null;}
    const targetKeys = new Set([...targetLines].map(lid => getKey(toStopId, lid)));

    while (pq.size > 0) {
      const popped = pq.pop();
      if (!popped) {break;}
      const { node, cost } = popped;
      const key = getKey(node.stopId, node.lineId);

      if (cost > (dist.get(key) ?? Infinity)) {continue;}

      if (targetKeys.has(key)) {
        return this.reconstructRoute(key, prev, networkMap);
      }

      const neighbors = adj.get(key) ?? [];
      for (const edge of neighbors) {
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
    // Trace back path
    const path: { stopId: string; lineId: string }[] = [];
    let current: string | null = endKey;

    while (current !== null) {
      const parts = current.split('|');
      const stopId = parts[0] ?? '';
      const lineId = parts[1] ?? '';
      path.unshift({ stopId, lineId });
      current = prev.get(current) ?? null;
    }

    // Build line lookup + stop name lookup
    const lineMap = new Map<string, NetworkLine>();
    for (const line of networkMap.lines) {
      lineMap.set(line.id, line);
    }
    const stopNameMap = new Map<string, string>();
    for (const stop of networkMap.stops) {
      stopNameMap.set(stop.id, stop.name);
    }

    // Group into segments by lineId
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

    // Compute direction for each segment
    for (const segment of segments) {
      const line = lineMap.get(segment.lineId);
      if (!line) {continue;}
      const itinerary = line.itineraries[0] ?? [];
      const firstStopId = segment.stopIds[0] ?? '';
      const lastStopId = segment.stopIds[segment.stopIds.length - 1] ?? '';

      if (itinerary.length >= 2 && segment.stopIds.length >= 2) {
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

    // Build transfer stop IDs (stops where segments change)
    const transferStopIds: string[] = [];
    for (let i = 1; i < segments.length; i++) {
      const seg = segments[i];
      if (!seg) {continue;}
      const transferStop = seg.stopIds[0];
      if (transferStop !== undefined && !transferStopIds.includes(transferStop)) {
        transferStopIds.push(transferStop);
      }
    }

    // Build deduplicated ordered list of all stops
    const allStopIds: string[] = [];
    for (const segment of segments) {
      for (const stopId of segment.stopIds) {
        if (allStopIds.length === 0 || allStopIds[allStopIds.length - 1] !== stopId) {
          allStopIds.push(stopId);
        }
      }
    }

    return {
      segments,
      transfers: Math.max(0, segments.length - 1),
      transferStopIds,
      allStopIds,
    };
  }
}
