# API Documentation

## Overview

The Transit Display Hub REST API provides endpoints to
manage the transport network, itineraries, schedules,
broadcast messages, devices, users, and the real-time
display.

**Base URL**: `http://localhost:8080/api`

## Authentication

### JWT Token

The API uses JWT (JSON Web Token) authentication. The
token must be included in the `Authorization` header for
all protected requests.

```text
Authorization: Bearer <token>
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response** (200 OK):

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-02-02T13:00:00Z",
  "role": "ADMIN",
  "username": "admin"
}
```

### Endpoint Permissions

| Endpoint                                   | Access       |
| ------------------------------------------ | ------------ |
| `/api/auth/**`                             | Public       |
| `/api/display/**`                          | Public       |
| `/api/network-map/**`                      | Public       |
| `/api/devices/authenticate`                | Public       |
| `GET /api/itineraries/**`                  | Public       |
| `GET /api/stops/*/schedules`               | Public       |
| `/api/messages/**`                         | Admin, Agent |
| `GET /api/lines/**`, `GET /api/stops/**`   | Admin, Agent |
| `/api/lines/**` (POST, PUT, DELETE)        | Admin        |
| `/api/stops/**` (POST, PUT, DELETE)        | Admin        |
| `/api/schedules/**` (POST, PUT, DELETE)    | Admin        |
| `/api/itineraries/**` (POST, PUT, DELETE)  | Admin        |
| `/api/devices/**`, `/api/users/**`         | Admin        |

---

## Lines

### List Lines

```http
GET /api/lines
Authorization: Bearer <token>
```

**Pagination parameters** (optional):

- `page`: Page number (0-indexed, enables pagination)
- `size`: Page size (default: 10)
- `sortBy`: Sort field (default: `code`)
- `sortDir`: Sort direction (`asc` or `desc`,
  default: `asc`)
- `search`: Text search

**Response without pagination** (200 OK):

```json
[
  {
    "id": "uuid",
    "code": "M1",
    "name": "Metro Line 1",
    "color": "#3B82F6",
    "type": "METRO",
    "stopCount": 12,
    "itineraryCount": 2
  }
]
```

**Response with pagination** (200 OK):

```json
{
  "content": [],
  "page": 0,
  "size": 10,
  "totalElements": 25,
  "totalPages": 3
}
```

### Get a Line

```http
GET /api/lines/{id}
Authorization: Bearer <token>
```

### Create a Line

```http
POST /api/lines
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "M2",
  "name": "Metro Line 2",
  "color": "#10B981",
  "type": "METRO"
}
```

**Fields**:

- `code` (required): Short identifier, max 10
  characters, unique
- `name` (required): Full name, max 100 characters
- `color` (required): Hexadecimal color
  (e.g., `#FF5733`)
- `type` (required): Line type
  (`METRO`, `BUS`, `TRAM`, `TRAIN`)

**Response** (201 Created)

### Update a Line

```http
PUT /api/lines/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "M2",
  "name": "Metro Line 2 - Express",
  "color": "#059669",
  "type": "METRO"
}
```

### Delete a Line

```http
DELETE /api/lines/{id}
Authorization: Bearer <token>
```

**Response** (204 No Content)

> **Warning**: Deleting a line also deletes its associated
> itineraries and schedules.

---

## Stops

### List Stops

```http
GET /api/stops
GET /api/stops?lineId={lineId}
Authorization: Bearer <token>
```

**Parameters**:

- `lineId` (optional): Filter by line
- `page`, `size`, `sortBy`, `sortDir`, `search`:
  Pagination (same format as lines, default sort: `name`)

**Response** (200 OK):

```json
[
  {
    "id": "uuid",
    "name": "Central Station",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "lines": [
      {
        "id": "uuid",
        "code": "M1",
        "name": "Metro Line 1",
        "color": "#3B82F6"
      }
    ],
    "scheduleCount": 24,
    "hasDevice": true
  }
]
```

### Create a Stop

```http
POST /api/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Market Square",
  "lineIds": ["line-uuid-1", "line-uuid-2"],
  "latitude": 48.8580,
  "longitude": 2.3540
}
```

**Fields**:

- `name` (required): Stop name, max 100 characters
- `lineIds` (required): Set of line IDs (at least one)
- `latitude` (optional): GPS coordinate
- `longitude` (optional): GPS coordinate

### Update a Stop

```http
PUT /api/stops/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Market Square - Center",
  "lineIds": ["line-uuid-1"],
  "latitude": 48.8580,
  "longitude": 2.3540
}
```

### Delete a Stop

```http
DELETE /api/stops/{id}
Authorization: Bearer <token>
```

---

## Itineraries

An itinerary represents an ordered route of stops on a
line (e.g., direction "Airport").

### List Itineraries

```http
GET /api/itineraries
GET /api/itineraries?lineId={lineId}
```

> GET requests are public (no authentication required).

**Parameters**:

- `lineId` (optional): Filter by line
- `page`, `size`, `sortBy`, `sortDir`, `search`:
  Pagination (default sort: `name`)

**Response** (200 OK):

```json
[
  {
    "id": "uuid",
    "name": "To Airport",
    "terminusName": "Airport",
    "line": {
      "id": "uuid",
      "code": "M1",
      "name": "Metro Line 1",
      "color": "#3B82F6"
    },
    "stops": [
      {
        "id": "stop-uuid",
        "name": "Central Station",
        "position": 0
      },
      {
        "id": "stop-uuid",
        "name": "Market Square",
        "position": 1
      },
      {
        "id": "stop-uuid",
        "name": "Airport",
        "position": 2
      }
    ]
  }
]
```

### Get an Itinerary

```http
GET /api/itineraries/{id}
```

### Create an Itinerary

```http
POST /api/itineraries
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "To Airport",
  "stopIds": ["stop-uuid-1", "stop-uuid-2", "stop-uuid-3"]
}
```

**Fields**:

- `lineId` (required): Line ID
- `name` (required): Itinerary name, max 100 characters
- `stopIds` (optional): Ordered list of stop IDs

**Response** (201 Created)

### Update an Itinerary

```http
PUT /api/itineraries/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "To Airport - Express"
}
```

### Delete an Itinerary

```http
DELETE /api/itineraries/{id}
Authorization: Bearer <token>
```

### Manage Itinerary Stops

#### Replace All Stops

```http
PUT /api/itineraries/{id}/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopIds": ["stop-uuid-1", "stop-uuid-2", "stop-uuid-3"]
}
```

#### Add a Stop to an Itinerary

```http
POST /api/itineraries/{id}/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "stop-uuid",
  "position": 2
}
```

#### Remove a Stop from an Itinerary

```http
DELETE /api/itineraries/{id}/stops/{stopId}
Authorization: Bearer <token>
```

---

## Schedules

Schedules are based on the itinerary model: each schedule
associates a departure time with a stop and an itinerary.

### List Schedules for a Stop

```http
GET /api/stops/{stopId}/schedules
```

> This endpoint is public.

**Response** (200 OK):

```json
[
  {
    "id": "uuid",
    "time": "08:15",
    "stopId": "stop-uuid",
    "itinerary": {
      "id": "itinerary-uuid",
      "name": "To Airport",
      "terminusName": "Airport",
      "line": {
        "id": "line-uuid",
        "code": "M1",
        "name": "Metro Line 1",
        "color": "#3B82F6"
      }
    }
  }
]
```

### Create a Schedule

```http
POST /api/stops/{stopId}/schedules
Authorization: Bearer <token>
Content-Type: application/json

{
  "time": "09:30",
  "itineraryId": "itinerary-uuid"
}
```

**Fields**:

- `time` (required): Departure time in `HH:mm` format
- `itineraryId` (required): Itinerary ID (determines
  line and direction)

### Update a Schedule

```http
PUT /api/schedules/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "time": "09:45",
  "itineraryId": "itinerary-uuid"
}
```

### Delete a Schedule

```http
DELETE /api/schedules/{id}
Authorization: Bearer <token>
```

---

## Broadcast Messages

### List Messages

```http
GET /api/messages
GET /api/messages?active=true
GET /api/messages?severity=CRITICAL
Authorization: Bearer <token>
```

**Parameters**:

- `active` (optional): `true` for active messages only
- `severity` (optional): Filter by severity
  (`INFO`, `WARNING`, `CRITICAL`)
- `page`, `size`, `sortBy`, `sortDir`, `search`:
  Pagination (default sort: `startTime` desc)

**Response** (200 OK):

```json
[
  {
    "id": "uuid",
    "title": "Ongoing works",
    "content": "Line M1 is disrupted.",
    "severity": "WARNING",
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z",
    "scopeType": "LINE",
    "scopeId": "line-uuid",
    "scopeInfo": {
      "name": "Metro Line 1"
    },
    "active": true
  }
]
```

### Create a Message

```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Service interrupted",
  "content": "Track incident. Service suspended.",
  "severity": "CRITICAL",
  "startTime": "2026-02-01T15:00:00Z",
  "endTime": "2026-02-01T18:00:00Z",
  "scopeType": "STOP",
  "scopeId": "stop-uuid"
}
```

**Fields**:

- `title` (required): Title, max 100 characters
- `content` (required): Content, max 500 characters
- `severity` (required): `INFO`, `WARNING`, or `CRITICAL`
- `startTime` (required): Start date/time (ISO 8601)
- `endTime` (required): End date/time (ISO 8601)
- `scopeType` (required): `NETWORK`, `LINE`, or `STOP`
- `scopeId` (optional): Line or stop ID (required if
  scope is LINE or STOP)

### Update a Message

```http
PUT /api/messages/{id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Delete a Message

```http
DELETE /api/messages/{id}
Authorization: Bearer <token>
```

---

## Devices

### List Devices

```http
GET /api/devices
GET /api/devices?status=ONLINE
Authorization: Bearer <token>
```

**Parameters**:

- `status` (optional): `ONLINE` or `OFFLINE`

**Response** (200 OK):

```json
[
  {
    "id": "uuid",
    "stopId": "stop-uuid",
    "stopName": "Central Station",
    "lines": [
      {
        "id": "line-uuid",
        "code": "M1",
        "name": "Metro Line 1",
        "color": "#3B82F6"
      }
    ],
    "status": "ONLINE",
    "lastHeartbeat": "2026-02-01T12:30:00Z"
  }
]
```

### Get a Device

```http
GET /api/devices/{id}
Authorization: Bearer <token>
```

### Register a Device

```http
POST /api/devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "stop-uuid"
}
```

**Response** (201 Created):

```json
{
  "id": "device-uuid",
  "token": "generated-token-to-save",
  "stopId": "stop-uuid",
  "stopName": "Central Station"
}
```

> **Important**: The `token` is only displayed once. It
> must be configured on the device.

### Update a Device

```http
PUT /api/devices/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "new-stop-uuid"
}
```

### Delete a Device

```http
DELETE /api/devices/{id}
Authorization: Bearer <token>
```

### Authenticate a Device

```http
POST /api/devices/authenticate
Content-Type: application/json

{
  "token": "device-token"
}
```

> This endpoint is public.

**Response** (200 OK):

```json
{
  "valid": true,
  "stopId": "stop-uuid",
  "stopName": "Central Station",
  "lines": [
    {
      "id": "line-uuid",
      "code": "M1",
      "name": "Metro Line 1",
      "color": "#3B82F6"
    }
  ]
}
```

---

## Users

### List Users

```http
GET /api/users
Authorization: Bearer <token>
```

**Parameters**:

- `page`, `size`, `sortBy`, `sortDir`, `search`:
  Pagination (default sort: `username`)

**Response** (200 OK):

```json
[
  {
    "id": "uuid",
    "username": "admin",
    "role": "ADMIN",
    "enabled": true
  }
]
```

### Get a User

```http
GET /api/users/{id}
Authorization: Bearer <token>
```

### Create a User

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "operator1",
  "password": "password123",
  "role": "AGENT"
}
```

**Fields**:

- `username` (required): 3 to 50 characters
- `password` (required): 6 to 100 characters
- `role` (required): `ADMIN` or `AGENT`

**Response** (201 Created)

### Update a User

```http
PUT /api/users/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "new-password",
  "role": "ADMIN",
  "enabled": true
}
```

**Fields**:

- `password` (optional): New password (6 to 100
  characters)
- `role` (required): `ADMIN` or `AGENT`
- `enabled` (required): Enable/disable the account

### Delete a User

```http
DELETE /api/users/{id}
Authorization: Bearer <token>
```

**Response** (204 No Content)

---

## Network Map

### Get the Complete Map

```http
GET /api/network-map
```

> This endpoint is public.

**Response** (200 OK): Complete network data (lines,
stops, schematic coordinates) for interactive map
rendering.

### Get Alerts

```http
GET /api/network-map/alerts
```

> This endpoint is public.

**Response** (200 OK): Active alert messages displayed
on the map.

---

## Display

### Get Display State by Stop

```http
GET /api/display/{stopId}
```

> This endpoint is public (no authentication required).

### Get Display State by Device Token

```http
GET /api/display
X-Device-Token: <device-token>
```

> Uses the device token to determine the associated stop.
> Returns 401 if the token is invalid.

**Response** (200 OK):

```json
{
  "stopId": "stop-uuid",
  "stopName": "Central Station",
  "lines": [
    {
      "id": "line-uuid",
      "code": "M1",
      "name": "Metro Line 1",
      "color": "#3B82F6"
    }
  ],
  "arrivals": [
    {
      "scheduledTime": "14:30",
      "destinationName": "Airport",
      "line": {
        "id": "line-uuid",
        "code": "M1",
        "name": "Metro Line 1",
        "color": "#3B82F6"
      }
    }
  ],
  "messages": [
    {
      "title": "Information",
      "content": "Remember to validate your travel pass.",
      "severity": "INFO"
    }
  ],
  "version": 42,
  "generatedAt": "2026-02-01T14:25:00Z"
}
```

---

## WebSocket

### Connection

```javascript
const socket = new SockJS('/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, () => {
  // Connection established
});
```

### Subscribe to Updates

```javascript
stompClient.subscribe(
  '/topic/display/{stopId}',
  (message) => {
    const displayState =
      JSON.parse(message.body);
    // Update the display
  }
);
```

### Device Heartbeat

```javascript
stompClient.send(
  '/app/device/heartbeat',
  {},
  JSON.stringify({ stopId: 'stop-uuid' })
);
```

---

## Error Codes

| Code | Description                                    |
| ---- | ---------------------------------------------- |
| 400  | Bad Request - Invalid data                     |
| 401  | Unauthorized - Missing or invalid token        |
| 403  | Forbidden - Insufficient permissions           |
| 404  | Not Found - Resource does not exist            |
| 409  | Conflict - E.g., line code already in use      |
| 500  | Internal Server Error                          |

### Error Format

All errors (including 401 and 403) return a structured
JSON response:

```json
{
  "timestamp": "2026-02-01T12:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Line code is required",
  "errors": [
    {
      "field": "code",
      "message": "must not be blank"
    }
  ],
  "path": "/api/lines"
}
```

The `errors` field is only present for validation
errors (400).

### 409 Error Messages

Depending on the type of violation:

- **Uniqueness constraint**: Data conflict: a record
  with this value already exists
- **Foreign key**: Cannot complete operation: this
  record is referenced by other data
- **Missing required field**: A required field is
  missing
