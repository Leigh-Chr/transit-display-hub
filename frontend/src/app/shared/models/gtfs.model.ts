// GTFS browse surfaces that don't belong to the core network model:
// flex stop-times and locations, attributions, shapes, pathways,
// booking rules, translations, feed-info, the import-audit log,
// realtime browse payloads and the aggregated data overview.
// Self-contained: no cross-domain imports.

// GTFS-flex stop_times (admin browse + public flex-windows lookup)
export interface FlexStopTime {
  id: string;
  itineraryId: string | null;
  itineraryName: string | null;
  lineCode: string | null;
  lineColor: string | null;
  stopSequence: number | null;
  stopId: string | null;
  stopName: string | null;
  locationExternalId: string | null;
  locationName: string | null;
  locationGroupExternalId: string | null;
  locationGroupName: string | null;
  /** ISO-8601 "HH:mm:ss". */
  startPickupDropOffWindow: string;
  endPickupDropOffWindow: string;
  pickupType: number | null;
  dropOffType: number | null;
  pickupBookingRuleId: string | null;
  pickupBookingRuleExternalId: string | null;
  dropOffBookingRuleId: string | null;
  dropOffBookingRuleExternalId: string | null;
  serviceCalendarId: string | null;
  serviceCalendarExternalId: string | null;
  stopHeadsign: string | null;
}

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

// Aggregated data overview (admin diagnostic)
export interface DataOverview {
  staticGtfs: DataOverviewStaticGtfs;
  realtime: DataOverviewRealtime;
}

interface DataOverviewStaticGtfs {
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
  pathways: number;
  stationLevels: number;
  fareAttributes: number;
  locationGroups: number;
  bookingRules: number;
  translations: number;
  attributions: number;
}

interface DataOverviewRealtime {
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

// GTFS booking rules (TAD — admin browse)
type BookingType = 'REAL_TIME' | 'SAME_DAY' | 'PRIOR_DAYS';

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

export interface StationLevelInfo {
  id: string;
  externalId: string;
  index: number;
  name: string | null;
}

export interface StationPathwayGraph {
  stationId: string;
  stationName: string;
  levels: StationLevelInfo[];
  pathways: Pathway[];
}

// GTFS import audit (admin browse)
export type ImportStatus = 'RUNNING' | 'SUCCESS' | 'SKIPPED_UNCHANGED' | 'FAILED';

/** Outcome of the post-import MobilityData runner — orthogonal to
 *  `status`. SUCCESS means the runner completed (the feed itself
 *  may still hold ERROR-level notices). */
type ValidationStatus = 'SUCCESS' | 'FAILED' | 'SKIPPED';

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
  validationStatus: ValidationStatus | null;
  validationNoticeErrors: number | null;
  validationNoticeWarnings: number | null;
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
