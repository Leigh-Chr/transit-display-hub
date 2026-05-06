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
  lines: LineInfo[];
  arrivals: ArrivalInfo[];
  messages: MessageInfo[];
  version: number;
  generatedAt: string;
}

export interface ArrivalInfo {
  scheduledTime: string;
  destinationName: string;
  line: LineInfo;
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
}

// Network Map
export interface NetworkMap {
  lines: NetworkLine[];
  stops: NetworkStop[];
  bounds: NetworkBounds;
  attribution?: string | null;
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
