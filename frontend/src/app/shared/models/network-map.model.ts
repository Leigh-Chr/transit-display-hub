// The schematic / network-map feature payloads and their WebSocket
// update envelopes.

import { LineType, MessageSeverity, WheelchairAccess } from './common.model';

export interface NetworkMap {
  lines: NetworkLine[];
  stops: NetworkStop[];
  /** Inline GTFS transfers powering the route-finder's interchange cost.
   *  Optional for backwards compatibility with payloads predating this
   *  field — consumers should default to an empty list. */
  transfers?: NetworkTransfer[];
  bounds: NetworkBounds;
  attribution?: string | null;
}

export interface NetworkTransfer {
  fromStopId: string;
  toStopId: string;
  /** GTFS transfer_type: 0 recommended, 1 timed, 2 minimum-time, 3 not possible. */
  transferType: number;
  minTransferTimeSeconds: number | null;
  /** GTFS from_route_id / to_route_id resolved to a line UUID. When set,
   *  the transfer applies only when alighting from {@code fromLineId}
   *  and boarding {@code toLineId}; otherwise the transfer is generic
   *  for the stop pair. */
  fromLineId?: string | null;
  toLineId?: string | null;
}

export interface NetworkLine {
  id: string;
  code: string;
  name: string;
  color: string;
  textColor?: string | null;
  type: LineType | null;
  category?: string | null;
  itineraries: string[][];
  /** Aggregate schedule count across every itinerary, stop and
   *  service calendar. Drives the schematic edge thickness scale —
   *  busier lines draw fatter. Falls back to 0 on legacy payloads
   *  predating this field. */
  scheduleCount?: number;
}

export interface NetworkStop {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  schematicX: number | null;
  schematicY: number | null;
  lineCodes: string[];
  /** GTFS wheelchair_boarding tri-state aggregated over the station's
   *  children when applicable. Drives the "accessible only" filter
   *  and the pictogram in the stop popup. */
  wheelchairBoarding?: WheelchairAccess | null;
  /** True when the stop or any of its child platforms has at least
   *  one on-request schedule (pickup_type 2/3). The map renders an
   *  on-demand indicator on the stop dot and the popup surfaces the
   *  per-arrival booking flow. */
  hasOnDemand?: boolean;
  /** Names of every Fares v2 area this stop belongs to, sorted.
   *  Empty when the feed has no areas.txt; the popup hides the
   *  zone pill in that case. */
  fareAreaNames?: string[];
}

export interface NetworkBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface AlertMessage {
  title: string;
  content: string;
  severity: MessageSeverity;
}

export interface NetworkMapAlerts {
  networkAlerts: AlertMessage[];
  lineAlerts: Record<string, AlertMessage[]>;
  stopAlerts: Record<string, AlertMessage[]>;
}

export interface NetworkMapFullUpdate {
  type: 'FULL_UPDATE';
  networkMap: NetworkMap;
  alerts: NetworkMapAlerts;
}

export interface NetworkMapAlertsUpdate {
  type: 'ALERTS_UPDATE';
  alerts: NetworkMapAlerts;
}

export type NetworkMapUpdate = NetworkMapFullUpdate | NetworkMapAlertsUpdate;
