// Enums
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

// Message
export interface ScopeInfo {
  name: string;
}

export interface BroadcastMessage {
  id: string;
  title: string;
  content: string;
  severity: MessageSeverity;
  startTime: string;
  endTime: string;
  scopeType: MessageScope;
  scopeId: string | null;
  scopeInfo: ScopeInfo | null;
  active: boolean;
}

export interface CreateMessageRequest {
  title: string;
  content: string;
  severity: MessageSeverity;
  startTime: string;
  endTime: string;
  scopeType: MessageScope;
  scopeId?: string | undefined;
}

// Device
export interface Device {
  id: string;
  stopId: string;
  stopName: string;
  lines: LineInfo[];
  status: DeviceStatus;
  lastHeartbeat?: string | undefined;
}

export interface DeviceRegistration {
  id: string;
  token: string;
  stopId: string;
  stopName: string;
}

export interface RegisterDeviceRequest {
  stopId: string;
}

// Auth
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  expiresAt: string;
  role: UserRole;
  username: string;
}

// Authenticated user (from JWT token)
export interface AuthUser {
  username: string;
  role: UserRole;
}

// User Management (full entity from API)
export interface User {
  id: string;
  username: string;
  role: UserRole;
  enabled: boolean;
}

export interface CreateUserRequest {
  username: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRequest {
  password?: string | undefined;
  role: UserRole;
  enabled: boolean;
}

// Display State
export interface DisplayState {
  stopId: string;
  stopName: string;
  /** GTFS platform_code for stops that publish one — null for bus poles
   *  and any stop without a platform designation. */
  stopPlatformCode?: string | null;
  /** GTFS stop_code — short identifier printed on the physical signpost
   *  (e.g. "BSP1234"). Rendered discreetly so passengers can confirm
   *  they're at the right stop. */
  stopShortCode?: string | null;
  lines: LineInfo[];
  arrivals: ArrivalInfo[];
  messages: MessageInfo[];
  version: number;
  generatedAt: string;
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

export interface ArrivalInfo {
  scheduledTime: string;
  destinationName: string;
  line: LineInfo;
  pickupKind?: PickupKind;
  wheelchairAccessible?: WheelchairAccess;
  bikesAllowed?: BikesAllowed;
  /** GTFS timepoint: false means the time is approximate. */
  timepoint?: boolean;
  /** Headway from frequencies.txt — seconds between consecutive
   *  departures during the active window. Null when the trip is on a
   *  fixed timetable. */
  frequencyHeadwaySeconds?: number | null;
}

export interface MessageInfo {
  title: string;
  content: string;
  severity: MessageSeverity;
}

// Hub Display State
export interface HubDisplayState {
  hubName: string;
  lines: LineInfo[];
  arrivals: HubArrivalInfo[];
  messages: MessageInfo[];
  version: number;
  generatedAt: string;
}

export interface HubArrivalInfo {
  scheduledTime: string;
  destinationName: string;
  platform: string;
  line: LineInfo;
  pickupKind?: PickupKind;
  wheelchairAccessible?: WheelchairAccess;
  bikesAllowed?: BikesAllowed;
  timepoint?: boolean;
  frequencyHeadwaySeconds?: number | null;
}

// Network Map
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
}

export interface NetworkStop {
  id: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  schematicX: number | null;
  schematicY: number | null;
  lineCodes: string[];
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

// GTFS Attribution (public credit block)
export interface Attribution {
  organizationName: string;
  producer: boolean;
  operator: boolean;
  authority: boolean;
  url: string | null;
  email: string | null;
  phone: string | null;
}

// GTFS Agency
export interface Agency {
  id: string;
  externalId: string | null;
  name: string;
  url: string | null;
  timezone: string | null;
  lang: string | null;
  phone: string | null;
  fareUrl: string | null;
  email: string | null;
}

// GTFS Feed Info (admin)
export interface FeedInfo {
  publisherName: string | null;
  publisherUrl: string | null;
  lang: string | null;
  defaultLang: string | null;
  feedVersion: string | null;
  contactEmail: string | null;
  contactUrl: string | null;
  /** ISO-8601 date "YYYY-MM-DD". */
  startDate: string | null;
  /** ISO-8601 date "YYYY-MM-DD". */
  endDate: string | null;
  sourceUrl: string | null;
  sourceHash: string | null;
  /** ISO-8601 instant. */
  importedAt: string | null;
}
