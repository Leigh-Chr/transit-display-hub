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
  /** GTFS-Realtime delay applied to {@link scheduledTime} (seconds).
   *  Positive = late, negative = early. Null = no realtime update
   *  covers this arrival; the kiosk renders the scheduled time
   *  unchanged. Zero is meaningful — "the feed says on time" — and
   *  triggers the live indicator. */
  realtimeDelaySeconds?: number | null;
  /** Platform_code of the actual stop this arrival comes from.
   *  On a per-platform kiosk this matches the stop's own
   *  platformCode and is redundant. On a parent-station kiosk
   *  (Phase 1.3 aggregation) it varies per arrival and the kiosk
   *  renders it as a badge. */
  platformCode?: string | null;
  /** TAD booking flow attached to this arrival when the pickup is
   *  on-demand. Null on regular fixed-route trips. */
  booking?: BookingInfo | null;
}

export interface BookingInfo {
  phone: string | null;
  bookingUrl: string | null;
  infoUrl: string | null;
  message: string | null;
  priorNoticeMinutes: number | null;
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
  realtimeDelaySeconds?: number | null;
  booking?: BookingInfo | null;
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
  /** GTFS agency.cemv_support — contactless EMV. May be overridden per
   *  line via Line.cemvSupport. */
  cemvSupport?: 0 | 1 | 2 | null;
}

// Aggregated data overview (admin diagnostic)
export interface DataOverview {
  staticGtfs: DataOverviewStaticGtfs;
  realtime: DataOverviewRealtime;
}

export interface DataOverviewStaticGtfs {
  agencies: number;
  lines: number;
  stops: number;
  /** Stops flagged disabled because the latest import didn't reference
   *  them. Counted separately so the dashboard can surface "X orphaned"
   *  without forcing the admin to scroll the full stop list. */
  disabledStops: number;
  itineraries: number;
  itineraryStops: number;
  schedules: number;
  serviceCalendars: number;
  transfers: number;
  shapes: number;
  pathways: number;
  stationLevels: number;
  fareAttributes: number;
  locationGroups: number;
  bookingRules: number;
  translations: number;
  attributions: number;
}

export interface DataOverviewRealtime {
  alerts: number;
  tripUpdates: number;
  vehiclePositions: number;
  alertsEnabled: boolean;
  tripUpdatesEnabled: boolean;
  vehiclePositionsEnabled: boolean;
}

// GTFS-Realtime (admin browse)
export interface RealtimeAlert {
  id: string;
  routeIds: string[];
  stopIds: string[];
  agencyIds: string[];
  headerText: string | null;
  descriptionText: string | null;
  url: string | null;
  cause: string | null;
  effect: string | null;
  severity: string | null;
}

export interface VehiclePosition {
  entityId: string;
  vehicleId: string | null;
  vehicleLabel: string | null;
  tripId: string | null;
  routeId: string | null;
  latitude: number | null;
  longitude: number | null;
  bearing: number | null;
  speedMetresPerSecond: number | null;
  currentStatus: string | null;
  currentStopId: string | null;
  currentStopSequence: number | null;
  congestionLevel: string | null;
  occupancyStatus: string | null;
  occupancyPercentage: number | null;
  /** Unix epoch seconds — when the vehicle reported this position. */
  timestampEpochSeconds: number | null;
}

// GTFS Fares v1 (admin browse)
export type FarePaymentMethod = 'ON_BOARD' | 'BEFORE_BOARDING';

export interface FareAttribute {
  id: string;
  externalId: string | null;
  price: string;
  currency: string;
  paymentMethod: FarePaymentMethod | null;
  /** GTFS transfers: 0=no transfers, 1=one, 2=two, null=unlimited. */
  transfers: number | null;
  /** Seconds during which a transfer remains valid. */
  transferDuration: number | null;
  agencyId: string | null;
  agencyName: string | null;
  rules: FareRuleSummary[];
}

export interface FareRuleSummary {
  id: string;
  routeId: string | null;
  routeCode: string | null;
  originId: string | null;
  destinationId: string | null;
  containsId: string | null;
}

// GTFS Fares v2 (admin browse)
export interface FaresV2 {
  areas: FareArea[];
  timeframes: FareTimeframe[];
  products: FareProduct[];
  legRules: FareLegRule[];
  transferRules: FareTransferRule[];
  networks: FareNetwork[];
  fareMedia: FareMedia[];
  legJoinRules: FareLegJoinRule[];
}

export interface FareLegJoinRule {
  id: string;
  fromNetworkId: string | null;
  toNetworkId: string | null;
  fromStopName: string | null;
  toStopName: string | null;
}

export interface FareNetwork {
  id: string;
  externalId: string;
  name: string | null;
  routeCount: number;
}

export interface FareMedia {
  id: string;
  externalId: string;
  name: string | null;
  /** GTFS fare_media_type: 0=none, 1=paper, 2=transit_card,
   *  3=contactless_emv, 4=mobile_app. */
  mediaType: number | null;
}

export interface FareArea {
  id: string;
  externalId: string;
  name: string | null;
  stopCount: number;
}

export interface FareTimeframe {
  id: string;
  timeframeGroupId: string;
  /** ISO-8601 "HH:mm:ss". */
  startTime: string | null;
  endTime: string | null;
  serviceId: string | null;
}

export interface FareProduct {
  id: string;
  externalId: string;
  name: string | null;
  fareMediaId: string | null;
  amount: string;
  currency: string;
}

export interface FareLegRule {
  id: string;
  legGroupId: string | null;
  networkId: string | null;
  fromAreaName: string | null;
  toAreaName: string | null;
  fromTimeframeGroupId: string | null;
  toTimeframeGroupId: string | null;
  productExternalId: string | null;
  productAmount: string | null;
  productCurrency: string | null;
  rulePriority: number | null;
}

export interface FareTransferRule {
  id: string;
  fromLegGroupId: string | null;
  toLegGroupId: string | null;
  transferCount: number | null;
  durationLimit: number | null;
  durationLimitType: number | null;
  /** GTFS fare_transfer_type: 0=combined, 1=A-then-transfer, 2=transfer-replaces-A. */
  fareTransferType: number;
  productExternalId: string | null;
  productAmount: string | null;
  productCurrency: string | null;
}

// GTFS booking rules (TAD — admin browse)
export type BookingType = 'REAL_TIME' | 'SAME_DAY' | 'PRIOR_DAYS';

export interface BookingRule {
  id: string;
  externalId: string | null;
  bookingType: BookingType;
  priorNoticeDurationMin: number | null;
  priorNoticeDurationMax: number | null;
  priorNoticeLastDay: number | null;
  /** ISO-8601 "HH:mm:ss". */
  priorNoticeLastTime: string | null;
  priorNoticeStartDay: number | null;
  phone: string | null;
  bookingUrl: string | null;
  infoUrl: string | null;
  message: string | null;
}

// GTFS shape (admin browse, per-itinerary)
export interface ShapePoint {
  latitude: number;
  longitude: number;
  /** Cumulative distance from the trip's first point, when the feed
   *  declares it. Useful for rendering distance markers along the path. */
  distTraveled: number | null;
}

export interface Shape {
  id: string;
  externalId: string | null;
  points: ShapePoint[];
}

// GTFS pathways (admin browse, per-stop)
export type PathwayMode =
  | 'WALKWAY'
  | 'STAIRS'
  | 'MOVING_SIDEWALK'
  | 'ESCALATOR'
  | 'ELEVATOR'
  | 'FARE_GATE'
  | 'EXIT_GATE';

export interface Pathway {
  id: string;
  externalId: string | null;
  fromStopId: string;
  fromStopName: string;
  toStopId: string;
  toStopName: string;
  pathwayMode: PathwayMode;
  bidirectional: boolean;
  lengthMetres: number | null;
  traversalTimeSeconds: number | null;
  stairCount: number | null;
  maxSlope: number | null;
  minWidthMetres: number | null;
  signpostedAs: string | null;
  reversedSignpostedAs: string | null;
}

// GTFS import audit (admin browse)
export type ImportStatus = 'RUNNING' | 'SUCCESS' | 'SKIPPED_UNCHANGED' | 'FAILED';

export interface ImportAudit {
  id: string;
  sourceUrl: string | null;
  sourceHash: string | null;
  /** ISO-8601 instant. */
  startedAt: string;
  /** ISO-8601 instant. Null while RUNNING. */
  completedAt: string | null;
  durationMs: number | null;
  linesCount: number | null;
  stopsCount: number | null;
  itinerariesCount: number | null;
  schedulesCount: number | null;
  status: ImportStatus;
  errorMessage: string | null;
  triggeredBy: string | null;
}

// GTFS translations (admin browse)
export interface Translation {
  id: string;
  tableName: string;
  recordId: string | null;
  fieldValue: string | null;
  fieldName: string;
  language: string;
  translation: string;
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

// GTFS-flex location (admin browse — locations.geojson polygons)
export interface FlexLocation {
  id: string;
  externalId: string;
  stopExternalId: string | null;
  name: string | null;
  /** GeoJSON geometry type: "Polygon" or "MultiPolygon". */
  geometryType: string;
  /** Raw GeoJSON {@code geometry} object as a JSON string — the
   *  consumer parses it client-side to render the polygon. */
  geometryJson: string;
  minLatitude: number | null;
  minLongitude: number | null;
  maxLatitude: number | null;
  maxLongitude: number | null;
}
