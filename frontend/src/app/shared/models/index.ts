// Enums
export type MessageSeverity = 'INFO' | 'WARNING' | 'CRITICAL';
export type MessageScope = 'NETWORK' | 'LINE' | 'STOP';
export type DeviceStatus = 'ONLINE' | 'OFFLINE';
export type UserRole = 'ADMIN' | 'AGENT';

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

// Stop
export interface Stop {
  id: string;
  name: string;
  line: LineInfo;
  scheduleCount: number;
}

export interface CreateStopRequest {
  name: string;
  lineId: string;
}

// Schedule / TimedEntry
export interface TimedEntry {
  id: string;
  time: string;
  stopId: string;
}

export interface CreateTimedEntryRequest {
  time: string;
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
  lineCode: string;
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

export interface User {
  username: string;
  role: UserRole;
}

// Display State
export interface DisplayState {
  stopId: string;
  stopName: string;
  line: LineInfo;
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
