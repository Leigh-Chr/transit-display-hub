// Admin-operations entities: broadcast messages, kiosk devices and
// the auth / user-management surface.

import { DeviceStatus, LineInfo, MessageScope, MessageSeverity, UserRole } from './common.model';

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
