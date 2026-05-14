// Core transit network entities: lines, itineraries, stops and
// schedules, plus their create/update request DTOs.

import { LineInfo, LineType, WheelchairAccess } from './common.model';

// Line
export interface Line {
  id: string;
  code: string;
  name: string;
  color: string;
  textColor?: string | null;
  type: LineType | null;
  /** GTFS route_sort_order — drives stable line ordering. */
  sortOrder?: number | null;
  /** GTFS route_desc — free-form description shown in the stop popup. */
  description?: string | null;
  /** GTFS route_url — public link to the operator's page. */
  url?: string | null;
  /** Operating agency id (when the line is bound to one). */
  agencyId?: string | null;
  /** Denormalised agency name so the admin UI can render the column
   *  without a second request. */
  agencyName?: string | null;
  /** GTFS routes.continuous_pickup — 0 = continuous service (any
   *  point along the route), 1 = no continuous (default), 2 = phone
   *  agency, 3 = coordinate with driver. Optional on legacy / mocked
   *  rows that predate the field; defaults to 1 in the renderer. */
  continuousPickup?: 0 | 1 | 2 | 3;
  /** GTFS routes.continuous_drop_off — same encoding. */
  continuousDropOff?: 0 | 1 | 2 | 3;
  /** GTFS routes.cemv_support — contactless EMV (card-tap) at line
   *  level. 0 not supported, 1 supported, 2 ask the operator. */
  cemvSupport?: 0 | 1 | 2 | null;
  stopCount: number;
  itineraryCount: number;
}

export interface CreateLineRequest {
  code: string;
  name: string;
  color: string;
  type: LineType;
}

// Itinerary
export interface ItineraryStopInfo {
  id: string;
  name: string;
  position: number;
}

export interface Itinerary {
  id: string;
  name: string;
  terminusName: string | null;
  directionId: 0 | 1 | null;
  /** GTFS trips.cars_allowed default — UNKNOWN/ALLOWED/NOT_ALLOWED. */
  carsAllowedDefault?: 'UNKNOWN' | 'ALLOWED' | 'NOT_ALLOWED' | null;
  /** GTFS trips.safe_duration_factor on the representative trip. */
  safeDurationFactor?: number | null;
  /** GTFS trips.safe_duration_offset (seconds). */
  safeDurationOffset?: number | null;
  line: LineInfo;
  stops: ItineraryStopInfo[];
}

export interface CreateItineraryRequest {
  lineId: string;
  name: string;
  stopIds?: string[] | undefined;
}

export interface UpdateItineraryStopsRequest {
  stopIds: string[];
}

export interface AddItineraryStopRequest {
  stopId: string;
  position?: number | undefined;
}

// Stop
export interface Stop {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  /** GTFS stop_code — signpost id (e.g. "BSP1234"). */
  shortCode?: string | null;
  /** GTFS platform_code — quay / track designation. */
  platformCode?: string | null;
  /** GTFS stop_desc. */
  description?: string | null;
  /** GTFS stop_url. */
  url?: string | null;
  /** GTFS wheelchair_boarding tri-state. */
  wheelchairBoarding?: WheelchairAccess | null;
  /** GTFS location_type: 0 platform / regular stop, 1 station.
   *  Drives the badge in the admin list and the parent-aggregation
   *  behaviour on a kiosk bound to a parent station. */
  locationType?: number;
  /** Parent station UUID when this row is a platform that belongs
   *  to a multi-platform station. Null on free-standing stops and
   *  parent stations themselves. */
  parentStopId?: string | null;
  /** Denormalised parent name so the admin list can render
   *  "Quai 4 — Saint-Lazare" without a second request. */
  parentStopName?: string | null;
  /** GTFS stops.zone_id — opaque label that fare_rules reference via
   *  origin_id / destination_id / contains_id. */
  zoneId?: string | null;
  /** GTFS stops.stop_access — 0 generally accessible, 1 staff-only. */
  stopAccess?: 0 | 1 | null;
  lines: LineInfo[];
  scheduleCount: number;
  hasDevice: boolean;
}

export interface CreateStopRequest {
  name: string;
  lineIds: string[];
  latitude?: number | undefined;
  longitude?: number | undefined;
}

// Schedule
export interface ItineraryInfo {
  id: string;
  name: string;
  terminusName: string | null;
  directionId: 0 | 1 | null;
  line: LineInfo;
}

export interface Schedule {
  id: string;
  time: string;
  stopId: string;
  itinerary: ItineraryInfo;
}

export interface CreateScheduleRequest {
  time: string;
  itineraryId: string;
}
