import { Injectable } from '@angular/core';
import { NetworkMap, NetworkStop, NetworkTransfer } from '@shared/models';

export interface GraphNode {
  stopId: string;
  lineId: string;
}

export interface AdjacencyEdge {
  key: string;
  node: GraphNode;
  cost: number;
}

export interface GraphBuildResult {
  adj: Map<string, AdjacencyEdge[]>;
  stopToLines: Map<string, Set<string>>;
}

export interface GraphBuildOptions {
  /** When true, prune stops whose `wheelchairBoarding` is
   *  `NOT_ACCESSIBLE`. Stops with `UNKNOWN` or `null` are kept —
   *  the spec defines them as "not declared", not "not accessible". */
  accessibleOnly?: boolean;

  /** Extra cost (seconds) added to every implicit transfer — i.e.
   *  same-stop interchange not declared in {@code transfers.txt}.
   *  Implicit transfers may traverse stairs / escalators that aren't
   *  visible to the route-finder, so bumping their cost steers PMR
   *  searches toward routes whose interchanges are explicitly modelled
   *  (and therefore typically vetted for accessibility). Default 0,
   *  recommended around 120s when {@link accessibleOnly} is true. */
  pathwayPenaltySeconds?: number;
}

/**
 * Composite key used to address a (stopId, lineId) vertex in the
 * route-finder graph. Exposed at module level so the search side
 * (RouteFinderService) decodes vertices using the same convention.
 */
export function nodeKey(stopId: string, lineId: string): string {
  return `${stopId}|${lineId}`;
}

/**
 * Builds the adjacency graph consumed by Dijkstra. Lives in its own
 * injectable so the search code in {@link
 * import('./route-finder.service').RouteFinderService}
 * stays focused on the path-finding loop and reconstruction
 * (~250 LOC each instead of one ~540 LOC file).
 */
@Injectable({ providedIn: 'root' })
export class RouteGraphBuilder {

  /** Default cost (seconds) applied to transfers not explicitly declared
   *  in transfers.txt. Calibrated against typical European urban metros:
   *  3 minutes of average wait + walk between platforms. The previous
   *  10000 magic number meant every interchange dwarfed the line-travel
   *  cost; routes through a single line, however indirect, always won. */
  static readonly DEFAULT_TRANSFER_COST_SECONDS = 180;

  /** Type 3 in transfers.txt = transfer impossible. We materialise it as
   *  a near-infinite cost so any path containing it loses to alternatives. */
  static readonly IMPOSSIBLE_TRANSFER_COST = 999_999;

  /** Build adjacency graph with same-line edges and transfer edges. We walk
   *  every itinerary of every line so branches, terminus-partial variants
   *  and reverse directions all contribute their adjacencies — otherwise a
   *  stop served only by a non-primary itinerary would be unreachable. */
  build(networkMap: NetworkMap, options?: GraphBuildOptions): GraphBuildResult {
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
    this.addTransferEdges(stopToLines, adj, transferIndex,
            options?.pathwayPenaltySeconds ?? 0);

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

  /** Builds a lookup from "fromStopId|toStopId" to every declared
   *  transfer. Both directions are indexed so transfers.txt's one-way
   *  semantics still let the route-finder find the cheap path in either
   *  travel direction. Multiple entries per pair coexist so a generic
   *  rule and a route-specific rule don't squash each other; the
   *  edge-builder picks the most-specific applicable entry per
   *  (lineI, lineJ) combination. */
  private indexTransfers(transfers: NetworkTransfer[]): Map<string, NetworkTransfer[]> {
    const index = new Map<string, NetworkTransfer[]>();
    for (const t of transfers) {
      const fwdKey = `${t.fromStopId}|${t.toStopId}`;
      const revKey = `${t.toStopId}|${t.fromStopId}`;
      this.appendTransferEntry(index, fwdKey, t);
      if (revKey !== fwdKey) {
        this.appendTransferEntry(index, revKey, t);
      }
    }
    return index;
  }

  private appendTransferEntry(
    index: Map<string, NetworkTransfer[]>, key: string, transfer: NetworkTransfer,
  ): void {
    const list = index.get(key);
    if (list) {
      list.push(transfer);
    } else {
      index.set(key, [transfer]);
    }
  }

  /** Pick the best-applicable transfer for the (lineI, lineJ) pair at
   *  a stop. Preference order:
   *  1. Both qualifiers match (fromLineId === lineI && toLineId === lineJ
   *     in either travel direction).
   *  2. Generic transfer with no qualifiers (fromLineId/toLineId both null).
   *  3. Cheapest entry overall (legacy behaviour for feeds that ship
   *     route-specific entries we can't disambiguate).
   *  Returns null when the candidate list is empty. */
  private pickTransferForPair(
    candidates: NetworkTransfer[], lineI: string, lineJ: string,
  ): NetworkTransfer | null {
    if (candidates.length === 0) {return null;}
    let bestSpecific: NetworkTransfer | null = null;
    let bestGeneric: NetworkTransfer | null = null;
    let cheapest: NetworkTransfer | null = null;
    for (const t of candidates) {
      if (cheapest === null
          || this.transferCostFor(t) < this.transferCostFor(cheapest)) {
        cheapest = t;
      }
      const matchesForward = t.fromLineId === lineI && t.toLineId === lineJ;
      const matchesReverse = t.fromLineId === lineJ && t.toLineId === lineI;
      if (matchesForward || matchesReverse) {
        if (bestSpecific === null
            || this.transferCostFor(t) < this.transferCostFor(bestSpecific)) {
          bestSpecific = t;
        }
        continue;
      }
      const isGeneric = (t.fromLineId === null || t.fromLineId === undefined)
          && (t.toLineId === null || t.toLineId === undefined);
      if (isGeneric && (bestGeneric === null
          || this.transferCostFor(t) < this.transferCostFor(bestGeneric))) {
        bestGeneric = t;
      }
    }
    return bestSpecific ?? bestGeneric ?? cheapest;
  }

  /** Resolves the Dijkstra cost for a declared transfer. Type 3 = not
   *  possible (effectively pruned), type 1 = timed (synced services,
   *  near-zero), others fall back to {@code minTransferTimeSeconds} or
   *  the global default. */
  private transferCostFor(transfer: NetworkTransfer): number {
    switch (transfer.transferType) {
      case 3: return RouteGraphBuilder.IMPOSSIBLE_TRANSFER_COST;
      case 1: return transfer.minTransferTimeSeconds ?? 0;
      default: return transfer.minTransferTimeSeconds ?? RouteGraphBuilder.DEFAULT_TRANSFER_COST_SECONDS;
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

      const keyA = nodeKey(a, lineId);
      const keyB = nodeKey(b, lineId);

      this.addEdge(adj, keyA, keyB, { stopId: b, lineId }, 1);
      this.addEdge(adj, keyB, keyA, { stopId: a, lineId }, 1);
    }
  }

  /** Add transfer edges between different lines at the same stop. The
   *  cost is the declared transfers.txt minimum-time when present, with
   *  a sensible default otherwise. {@code pathwayPenalty} is added to
   *  every implicit transfer (no transfers.txt entry) — handy for
   *  PMR-aware searches that want to favour explicitly-modelled
   *  interchanges. */
  private addTransferEdges(
    stopToLines: Map<string, Set<string>>,
    adj: Map<string, AdjacencyEdge[]>,
    transferIndex: Map<string, NetworkTransfer[]>,
    pathwayPenalty: number,
  ): void {
    for (const [stopId, lineIds] of stopToLines) {
      const lines = [...lineIds];
      const selfTransferList = transferIndex.get(`${stopId}|${stopId}`) ?? [];

      for (let i = 0; i < lines.length; i++) {
        for (let j = i + 1; j < lines.length; j++) {
          const lineI = lines[i];
          const lineJ = lines[j];
          if (lineI === undefined || lineJ === undefined) {continue;}

          const declared = this.pickTransferForPair(selfTransferList, lineI, lineJ);
          const baseCost = declared
              ? this.transferCostFor(declared)
              : RouteGraphBuilder.DEFAULT_TRANSFER_COST_SECONDS;
          if (baseCost >= RouteGraphBuilder.IMPOSSIBLE_TRANSFER_COST) {continue;}
          const cost = declared ? baseCost : baseCost + pathwayPenalty;

          const keyA = nodeKey(stopId, lineI);
          const keyB = nodeKey(stopId, lineJ);

          this.addEdge(adj, keyA, keyB, { stopId, lineId: lineJ }, cost);
          this.addEdge(adj, keyB, keyA, { stopId, lineId: lineI }, cost);
        }
      }
    }
  }

  private addEdge(
    adj: Map<string, AdjacencyEdge[]>, fromKey: string, toKey: string, toNode: GraphNode, cost: number
  ): void {
    if (!adj.has(fromKey)) {adj.set(fromKey, []);}
    adj.get(fromKey)?.push({ key: toKey, node: toNode, cost });
  }
}
