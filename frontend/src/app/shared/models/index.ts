// Enums
export type MessageSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type MessageScope = 'NETWORK' | 'LINE' | 'STOP';
export type DeviceStatus = 'ONLINE' | 'OFFLINE';
export type UserRole = 'ADMIN' | 'AGENT';

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
  page?: number;
  size?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  search?: string;
}

// Common nested types
export interface LineInfo {
  id?: string;
  code: string;
  name: string;
  color: string;
}

// Line
export interface Line {
  id: string;
  code: string;
  name: string;
  color: string;
  stopCount: number;
}

export interface CreateLineRequest {
  code: string;
  name: string;
  color: string;
}

// Route
export interface Route {
  id: string;
  name: string;
  terminusName: string;
  line: LineInfo;
}

export interface RouteInfo {
  id: string;
  name: string;
  terminusName: string;
  line: LineInfo;
}

export interface CreateRouteRequest {
  lineId: string;
  name: string;
  terminusName: string;
}

// Stop
export interface Stop {
  id: string;
  name: string;
  lines: LineInfo[];
  scheduleCount: number;
}

export interface CreateStopRequest {
  name: string;
  lineIds: string[];
}

// Schedule / TimedEntry
export interface TimedEntry {
  id: string;
  time: string;
  stopId: string;
  route: RouteInfo;
}

export interface CreateTimedEntryRequest {
  time: string;
  routeId: string;
}

// Message
export interface ScopeInfo {
  name: string;
  lineCode?: string;
  lineColor?: string;
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
  scopeId?: string;
}

// Device
export interface Device {
  id: string;
  stopId: string;
  stopName: string;
  lines: LineInfo[];
  status: DeviceStatus;
  lastHeartbeat?: string;
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

export interface DeviceAuthRequest {
  token: string;
}

export interface DeviceAuthResponse {
  valid: boolean;
  stopId: string | null;
  stopName: string | null;
  lineCode: string | null;
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
  password?: string;
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
