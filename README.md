# Transit Display Hub

Real-time passenger information platform for public
transport networks.

## Overview

Transit Display Hub allows transport operators to manage
their network (lines, stops, itineraries, schedules),
broadcast alert messages, and display real-time information
on screens at stops.

### Key Features

- **Network management**: Configure lines (metro, bus,
  tram, train), stops, itineraries, and schedules
- **Broadcast messages**: Send alerts (Info, Warning,
  Critical) with scope targeting (network, line, stop)
- **Real-time display**: Kiosk screens with automatic
  updates via WebSocket
- **Network map**: Interactive network visualization with
  route search
- **Device management**: Registration and monitoring of
  display screens
- **User management**: Account administration (Admin,
  Agent)

## Tech Stack

| Component      | Technology                                 |
| -------------- | ------------------------------------------ |
| Backend        | Spring Boot 4.0.2, Java 21                 |
| Frontend       | Angular 21, Tailwind CSS, Angular Material |
| Database       | H2 (dev), PostgreSQL (prod)                |
| Real-time      | WebSocket with STOMP                       |
| Authentication | JWT                                        |
| Tests          | JUnit 5, Vitest, Playwright                |

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
+-- docs/                    # Documentation
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
- [Changelog](CHANGELOG.md) - Version history
- [Contributing](CONTRIBUTING.md) - Contribution guide

## License

Proprietary - All rights reserved
