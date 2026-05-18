import { Signal, computed } from '@angular/core';

import type { RouteResult } from '../../services/route-finder.service';
import {
  buildRouteActiveEdges,
  buildRouteDirectionArrows,
  buildRouteOverlayPaths,
  buildRouteStopsByLine,
  type NetworkLineRow,
} from './schematic-geometry';

export interface RouteOverlay {
  readonly hasRoute: Signal<boolean>;
  readonly transferStopIds: Signal<Set<string>>;
  /** Map<lineId, Set<edgeKey>> where edgeKey = "stopA|stopB" (sorted). */
  readonly activeEdges: Signal<Map<string, Set<string>>>;
  /** Map<lineId, Set<stopId>> — stops that touch an active edge on that line. */
  readonly stopsByLine: Signal<Map<string, Set<string>>>;
  /** For each visible line row, a path covering only the active route edges. */
  readonly overlayPaths: Signal<{ lineId: string; color: string; path: string }[]>;
  /** Direction arrows along each route segment. */
  readonly directionArrows: Signal<{ x: number; y: number; right: boolean; color: string }[]>;
}

/**
 * Bundles the six derived signals that paint the highlighted route on
 * top of the network schematic. The composable is pure (no injection,
 * no side effects) — its only job is to consolidate the per-segment
 * geometry into a single named seam so the host component stops owning
 * six route-specific {@code computed()} declarations.
 *
 * The underlying transforms live in {@link buildRouteActiveEdges},
 * {@link buildRouteStopsByLine}, {@link buildRouteOverlayPaths} and
 * {@link buildRouteDirectionArrows}; the wrapping {@code computed()}
 * calls give them their reactive shape.
 */
export function useRouteOverlay(input: {
  routeResult: Signal<RouteResult | null>;
  networkLineRows: Signal<NetworkLineRow[]>;
}): RouteOverlay {
  const hasRoute = computed(() => input.routeResult() !== null);
  const transferStopIds = computed(
    () => new Set(input.routeResult()?.transferStopIds ?? []),
  );
  const activeEdges = computed(() => buildRouteActiveEdges(input.routeResult()));
  const stopsByLine = computed(() => buildRouteStopsByLine(input.routeResult()));
  const overlayPaths = computed(
    () => buildRouteOverlayPaths(activeEdges(), input.networkLineRows()),
  );
  const directionArrows = computed(
    () => buildRouteDirectionArrows(input.routeResult(), input.networkLineRows()),
  );

  return { hasRoute, transferStopIds, activeEdges, stopsByLine, overlayPaths, directionArrows };
}
