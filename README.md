# Transit Display Hub

Real-time passenger information platform for public
transport networks.

## Overview

Transit Display Hub allows transport operators to manage
their network (lines, stops, itineraries, schedules),
broadcast alert messages, and display real-time information
on screens at stops.

### Key Features

- **100 % GTFS spec coverage** — Schedule v1 (20 files), Fares
  v1, Fares v2, GTFS-flex (canonical 2024) and GTFS-Realtime
  (ServiceAlerts + TripUpdates + VehiclePositions, including
  feed header metadata, vehicle descriptors and per-stop
  occupancy). Backed by the canonical
  [MobilityData gtfs-validator] which runs after every import
  and surfaces its report in the admin timeline (see ADR 0034).
- **GTFS coverage detail**: full schedule import (20 standard
  files) — agency, routes, stops with parent_station /
  platform hierarchy, trips, stop_times, multi-day
  calendars, transfers, attributions, frequencies (with
  fan-out into per-departure rows), pathways, levels,
  translations, fares v1, shapes, location groups,
  booking rules, feed_info
- **GTFS Fares v2**: areas, timeframes, products,
  leg / transfer / leg-join rules, networks and fare media
- **GTFS-Realtime**: ServiceAlerts, TripUpdates and
  VehiclePositions polled via vendored protobuf bindings;
  live delay badges and projected times on the kiosk
- **Demand-responsive transit (TAD)**: `booking_rules`
  resolved per arrival; phone / URL CTA on kiosk and hub
- **Per-platform routing** (Phase 1.3): each GTFS platform
  persists separately; kiosks bound to a parent station
  aggregate child schedules transparently
- **Network management**: lines (metro, bus, tram, train,
  ferry, funicular, cable car, trolleybus, monorail),
  stops, itineraries, and schedules
- **Broadcast messages**: alerts (Info, Warning, Critical)
  with scope targeting (network, line, stop)
- **Real-time display**: kiosk screens with automatic
  updates via WebSocket
- **Network map**: interactive schematic with parent /
  platform collapse, fare-zone and accessibility filters,
  frequency-scaled stroke width, TAD-ring indicators and
  toggleable fare-zone color overlay; the stop popup
  inlines the GTFS-flex zone polygon when the stop carries
  one
- **GTFS-flex `locations.geojson`**: polygons persisted
  with a pre-computed bounding box, browsable on the
  `/admin/tad-zones` map, point-in-polygon spatial query
  on `/api/admin/locations/contains?lat=…&lon=…` (no JTS
  / PostGIS — see ADR 0026 + 0029)
- **Admin browsers**: read-only pages for every imported
  GTFS family — fares v1+v2, TAD, translations, pathways,
  shapes, locations, import audit (with
  [MobilityData] validation report), real-time caches

[MobilityData gtfs-validator]: https://github.com/MobilityData/gtfs-validator
[MobilityData]: https://github.com/MobilityData/gtfs-validator
- **OpenAPI / Swagger UI** bundled at `/swagger-ui.html`
- **Observability**: Prometheus scrape at
  `/actuator/prometheus` with custom GTFS import meters,
  JVM / HTTP / Caffeine cache series; ready-to-import
  Grafana dashboard at `ops/grafana/transit-display-hub.json`
  (see ADR 0027)
- **Performance benchmarks**: JMH micro-benchmarks for the
  three hot-path utilities plus a full-stack Spring-context
  benchmark on the kiosk refresh path (`./gradlew jmh`,
  see ADR 0028)
- **Device management**: registration and monitoring of
  display screens
- **User management**: account administration (Admin,
  Agent)

## Tech Stack

| Component      | Technology                                                  |
| -------------- | ----------------------------------------------------------- |
| Backend        | Spring Boot 4.0.2, Java 21                                  |
| Frontend       | Angular 21.2, Angular Material (M3)                         |
| Database       | H2 (dev), PostgreSQL (prod)                                 |
| Real-time      | WebSocket with STOMP                                        |
| Authentication | JWT                                                         |
| Tests          | JUnit 5, Vitest                                             |
| Benchmarks     | JMH (micro + Spring full-stack)                             |
| Observability  | Spring Actuator + Micrometer + Prometheus + Grafana         |

## Quick Start

### Prerequisites

- Java 21 (JDK)
- Node.js 20+
- npm 10+

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd transit-display-hub

# Backend
cd backend
./gradlew bootRun

# Frontend (new terminal)
cd frontend
npm install
npm start
```

### Access

- **Admin Interface**: <http://localhost:4200>
- **Backend API**: <http://localhost:8080>
- **Network Map**: <http://localhost:4200/map>
- **Kiosk Display**:
  `http://localhost:4200/display/{stopId}`

### Default Credentials

| Username | Password | Role          |
| -------- | -------- | ------------- |
| admin    | admin123 | Administrator |
| agent    | agent123 | Agent         |

## Project Structure

```text
transit-display-hub/
+-- backend/                 # Spring Boot API
|   +-- src/main/java/
|   |   +-- com/transit/hub/
|   |       +-- domain/      # Entities, enums, events
|   |       +-- application/ # Services, DTOs, exceptions
|   |       +-- infrastructure/ # Security, WebSocket
|   |       +-- api/         # REST Controllers
|   +-- build.gradle.kts
+-- frontend/                # Angular Application
|   +-- src/app/
|   |   +-- core/           # Services, auth, WebSocket
|   |   +-- shared/         # Models, components
|   |   +-- features/       # Admin, display, map
|   |   +-- layouts/        # Admin/display layouts
|   +-- package.json
+-- ops/                     # Operations artifacts
|   +-- grafana/            # Dashboard JSON + provisioning notes
+-- docs/                    # Documentation
|   +-- adr/                # Architecture Decision Records (34)
```

## Documentation

- [Installation Guide](docs/installation.md) -
  Set up the development environment
- [API Documentation](docs/api.md) -
  Complete REST API reference
- [Developer Guide](docs/developer-guide.md) -
  Architecture and best practices
- [Deployment Guide](docs/deployment.md) -
  Production deployment
- [User Guide](docs/user-guide.md) -
  Admin interface usage
- [Architecture Decision Records](docs/adr/README.md) -
  34 ADRs documenting non-obvious choices
- [Grafana provisioning](ops/grafana/README.md) -
  Importing the bundled dashboard
- [Changelog](CHANGELOG.md) - Version history
- [Contributing](CONTRIBUTING.md) - Contribution guide

## License

Proprietary - All rights reserved
