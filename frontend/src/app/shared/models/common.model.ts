// Shared enums, pagination envelopes and the cross-domain LineInfo
// summary. Everything here is leaf-level — no model file imports from
// another except through this one.

export type MessageSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type MessageScope = 'NETWORK' | 'LINE' | 'STOP';
export type DeviceStatus = 'ONLINE' | 'OFFLINE';
export type UserRole = 'ADMIN' | 'AGENT';
export type LineType =
  | 'METRO'
  | 'BUS'
  | 'TRAM'
  | 'TRAIN'
  | 'FERRY'
  | 'FUNICULAR'
  | 'CABLE_CAR'
  | 'TROLLEYBUS'
  | 'MONORAIL'
  | 'OTHER';

// Pagination
export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

export interface PageRequest {
  page?: number | undefined;
  size?: number | undefined;
  sortBy?: string | undefined;
  sortDir?: 'asc' | 'desc' | undefined;
  search?: string | undefined;
}

// Common nested types
export interface LineInfo {
  id: string;
  code: string;
  name: string;
  color: string;
  /** Foreground color resolved server-side (from GTFS route_text_color or
   *  derived via YIQ luminance). May be absent on legacy rows or test
   *  fixtures; consumers should reach for {@link lineTextColor} which
   *  falls back to {@link readableTextColor} on the background color. */
  textColor?: string | null;
}

/** Passenger-facing summary of GTFS pickup_type / drop_off_type. */
export type PickupKind =
  | 'NORMAL'
  | 'DROP_OFF_ONLY'
  | 'PICKUP_ONLY'
  | 'ON_REQUEST_AGENCY'
  | 'ON_REQUEST_DRIVER';

/** Tri-state wheelchair access mirroring GTFS conventions. */
export type WheelchairAccess = 'UNKNOWN' | 'ACCESSIBLE' | 'NOT_ACCESSIBLE';

/** Tri-state bicycle policy. */
export type BikesAllowed = 'UNKNOWN' | 'ALLOWED' | 'NOT_ALLOWED';
