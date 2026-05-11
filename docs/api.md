# API Documentation

The Transit Display Hub REST API exposes endpoints for the
network (lines, stops, itineraries, schedules), broadcast
messages, devices, users, public GTFS browsers and the
real-time display state.

**Base URL**: `http://localhost:8080/api`

The full machine-readable specification is bundled at
`/v3/api-docs`; a Swagger UI is exposed at
[`/swagger-ui.html`](http://localhost:8080/swagger-ui.html).
This document only covers the cross-cutting parts (auth,
errors, WebSocket, observability) — for endpoint signatures
and request / response schemas, prefer the Swagger explorer.

## Authentication

Since v1.4.0 the API supports two transports for the same JWT
identity, and ships a server-side refresh-token flow with rotation.
The full architectural rationale lives in
[ADR 0039](adr/0039-cookie-based-auth-with-refresh-tokens.md).

### Transports

- **Cookie-based session** (default for browser callers). On
  successful login the backend sets two `HttpOnly` cookies:
  - `ACCESS_TOKEN` (path `/`, short TTL aligned on
    `app.jwt.expiration-hours`).
  - `REFRESH_TOKEN` (path `/api/auth`, long TTL governed by
    `app.jwt.refresh-expiration-days`, default 14 days).
  Browser callers also receive a non-`HttpOnly` `XSRF-TOKEN` cookie
  and must mirror its value into the `X-XSRF-TOKEN` header on
  mutating requests.
- **Bearer header** (Swagger UI, CLI, STOMP CONNECT, integrators).
  Pass the JWT returned in the JSON body verbatim:

  ```text
  Authorization: Bearer <token>
  ```

  Bearer callers are exempt from CSRF protection — browsers never
  attach that header automatically.

### Endpoints

| Method | Endpoint               | Purpose                                                                        |
| ------ | ---------------------- | ------------------------------------------------------------------------------ |
| `POST` | `/api/auth/login`      | Validate credentials, set cookies, return the JWT in the body for compat       |
| `POST` | `/api/auth/refresh`    | Consume the refresh cookie, rotate it, mint a fresh access token + cookies     |
| `POST` | `/api/auth/logout`     | Revoke the refresh token server-side and clear both cookies                    |
| `GET`  | `/api/auth/me`         | Return `{ username, role }` rebuilt from the current `SecurityContext`         |

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Response** (200 OK, headers + body):

```text
Set-Cookie: ACCESS_TOKEN=eyJhbGciOiJIUzI1NiI...; Path=/; HttpOnly; SameSite=Strict
Set-Cookie: REFRESH_TOKEN=opaque-256-bit-value; Path=/api/auth; HttpOnly; SameSite=Strict
```

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-02-02T13:00:00Z",
  "role": "ADMIN",
  "username": "admin"
}
```

### Refresh

```http
POST /api/auth/refresh
Cookie: REFRESH_TOKEN=<the value the browser is holding>
```

Returns the same `LoginResponse` shape as `/login` plus rotated
cookies. The previous refresh token is revoked and any subsequent
replay attempt burns the user's active refresh chain — interpreted
as token theft.

### Logout

```http
POST /api/auth/logout
Cookie: REFRESH_TOKEN=…
```

Returns `204 No Content` with two clearing `Set-Cookie` headers.
Idempotent — calling without a cookie is a no-op.

### Endpoint Permissions

| Endpoint                                   | Access       |
| ------------------------------------------ | ------------ |
| `POST /api/auth/{login,refresh,logout}`    | Public       |
| `GET /api/auth/me`                         | Authenticated |
| `/api/display/**`                          | Public       |
| `/api/network-map/**`                      | Public       |
| `GET /api/itineraries/**`                  | Public       |
| `GET /api/stops/*/schedules`               | Public       |
| `/api/messages/**`                         | Admin, Agent |
| `GET /api/lines/**`, `GET /api/stops/**`   | Admin, Agent |
| `/api/lines/**` (POST, PUT, DELETE)        | Admin        |
| `/api/stops/**` (POST, PUT, DELETE)        | Admin        |
| `/api/schedules/**` (POST, PUT, DELETE)    | Admin        |
| `/api/itineraries/**` (POST, PUT, DELETE)  | Admin        |
| `/api/devices/**`, `/api/users/**`         | Admin        |
| `/api/admin/**`                            | Admin        |

## Errors

| Code | Description                                                                |
| ---- | -------------------------------------------------------------------------- |
| 400  | Bad Request — invalid data                                                 |
| 401  | Unauthorized — missing or invalid token / refresh token revoked or expired |
| 403  | Forbidden — insufficient permissions, or missing / mismatched X-XSRF-TOKEN |
| 404  | Not Found — resource does not exist                                        |
| 409  | Conflict — uniqueness or referential violation                             |
| 500  | Internal Server Error                                                      |

All errors (including 401 and 403) return a structured JSON
response:

```json
{
  "timestamp": "2026-02-01T12:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Line code is required",
  "errors": [
    { "field": "code", "message": "must not be blank" }
  ],
  "path": "/api/lines"
}
```

The `errors` array is only present for validation failures.
For 409 Conflict, the `message` field distinguishes
uniqueness violations, foreign-key references and missing
required fields.

## WebSocket

Live display state is pushed over STOMP at `/ws`.

```javascript
import { Client } from '@stomp/stompjs';

const client = new Client({
  brokerURL: 'ws://localhost:8080/ws',
  onConnect: () => {
    client.subscribe('/topic/display/{stopId}', (msg) => {
      const displayState = JSON.parse(msg.body);
      // update the UI
    });
  },
});
client.activate();

// Device heartbeat
client.publish({
  destination: '/app/device/heartbeat',
  body: JSON.stringify({ stopId: 'stop-uuid' }),
});
```

## GTFS coverage browsers

Read-only endpoints over the imported GTFS extension tables.
All `/api/admin/**` paths require `ROLE_ADMIN`; each is
mirrored by a dedicated admin page in the UI.

| Method | Endpoint                                    | Purpose                                                |
| ------ | ------------------------------------------- | ------------------------------------------------------ |
| `GET`  | `/api/admin/data-overview`                  | aggregate counters of every persisted entity           |
| `GET`  | `/api/admin/feed-info`                      | `feed_info.txt` singleton row                          |
| `GET`  | `/api/admin/import-audit?limit=N`           | last N import attempts                                 |
| `GET`  | `/api/admin/fares`                          | Fares v1 (`fare_attributes` + `fare_rules`)            |
| `GET`  | `/api/admin/fares-v2`                       | Fares v2 graph (areas, timeframes, products, rules)    |
| `GET`  | `/api/admin/booking-rules`                  | `booking_rules.txt` rows                               |
| `GET`  | `/api/admin/translations?lang=…&table=…`    | translations for a target language                     |
| `GET`  | `/api/admin/realtime/alerts`                | GTFS-RT ServiceAlerts cache snapshot                   |
| `POST` | `/api/admin/realtime/alerts/refresh`        | force an immediate alerts poll                         |
| `GET`  | `/api/admin/realtime/vehicles`              | GTFS-RT VehiclePositions cache snapshot                |
| `POST` | `/api/admin/realtime/vehicles/refresh`      | force an immediate vehicles poll                       |
| `GET`  | `/api/admin/locations`                      | GTFS-flex `locations.geojson` polygons (TAD zones)     |
| `GET`  | `/api/admin/locations/contains?lat=X&lon=Y` | flex zones containing a point (bbox + ray-cast)        |

Public read-only counterparts:

| Method | Endpoint                                       | Purpose                                          |
| ------ | ---------------------------------------------- | ------------------------------------------------ |
| `GET`  | `/api/attributions`                            | public credit block (`attributions.txt`)         |
| `GET`  | `/api/itineraries/{id}/shape`                  | GTFS polyline of an itinerary                    |
| `GET`  | `/api/stops/{id}/pathways`                     | indoor topology for a station                    |
| `GET`  | `/api/network-map`                             | full schematic + lines + transfers               |
| `GET`  | `/api/network-map/alerts`                      | active broadcast + GTFS-RT alerts                |
| `GET`  | `/api/network-map/stops/{stopId}/tad-zone`     | flex zone polygon attached to an on-demand stop  |

## Operations endpoints (Spring Actuator)

| Method | Endpoint                  | Auth       | Purpose                                  |
| ------ | ------------------------- | ---------- | ---------------------------------------- |
| `GET`  | `/actuator/health`        | public     | liveness / readiness probe (UP/DOWN)     |
| `GET`  | `/actuator/info`          | public     | build metadata                           |
| `GET`  | `/actuator/prometheus`    | public     | Prometheus scrape format (Micrometer)    |
| `GET`  | `/actuator/metrics`       | admin only | JSON listing of meter names              |

### Custom GTFS import meters

| Meter                   | Type                 | Tags                                  |
| ----------------------- | -------------------- | ------------------------------------- |
| `gtfs.import.duration`  | Timer + histogram    | `application=transit-display-hub`     |
| `gtfs.import.completed` | Counter              | `status=success\|failed\|skipped`     |
| `gtfs.import.entities`  | Distribution summary | `kind=lines\|stops\|schedules`        |

Caffeine cache hit ratios, JVM memory and HTTP server timings
are auto-bound by Spring Boot Actuator. See ADR 0027 and the
ready-to-import Grafana dashboard at
`ops/grafana/transit-display-hub.json`.
