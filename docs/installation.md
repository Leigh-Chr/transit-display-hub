# Installation Guide

## System Prerequisites

### Backend (prerequisites)

- **Java**: JDK 21 or higher
- **Gradle**: 8.x+ (wrapper included)

### Frontend (prerequisites)

- **Node.js**: 20.x or higher
- **npm**: 10.x or higher

### Database (Production)

- **PostgreSQL**: 15.x or higher

## Development Installation

### 1. Clone the Repository

```bash
git clone <repository-url>
cd transit-display-hub
```

### 2. Backend Setup

```bash
cd backend
```

#### With SDKMAN (recommended for Java)

```bash
# Install SDKMAN if needed
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh

# Install Java 21
sdk install java 21.0.5-tem
```

#### Verify Installation

```bash
java --version
# Should display: openjdk 21.x.x
```

#### Start the Backend

```bash
./gradlew bootRun
```

The server starts at <http://localhost:8080>

### 3. Frontend Setup

```bash
cd frontend
npm install
```

#### Start the Frontend

```bash
npm start
```

The application starts at <http://localhost:4200>

## Configuration

### Backend - application.yml

The configuration file is located at
`backend/src/main/resources/application.yml`.

#### Environment Variables

- `SPRING_PROFILES_ACTIVE`: Active profile (dev, prod).
  Default: `dev`
- `DATABASE_URL`: PostgreSQL connection URL.
  Default: `jdbc:postgresql://localhost:5432/transit`
- `DATABASE_USER`: PostgreSQL user.
  Default: `transit`
- `DATABASE_PASSWORD`: PostgreSQL password.
  Default: `transit`
- `JWT_SECRET`: JWT secret key (min 256 bits).
  Required in prod
- `APP_TIMEZONE`: operator local timezone for schedule
  comparisons. Default: `Europe/Paris`

##### GTFS-Realtime feeds (optional)

Each polling URL is independent — leave blank to disable
the corresponding feed without affecting the others.

- `app.gtfs-rt.alerts-url`: ServiceAlerts GTFS-RT feed
- `app.gtfs-rt.alerts-poll-cron`: cron for the alert
  refresh; default every 30 s
- `app.gtfs-rt.trip-updates-url`: TripUpdates feed (delays
  per arrival, projected times)
- `app.gtfs-rt.trip-updates-poll-cron`: cron, default
  every 30 s
- `app.gtfs-rt.vehicle-positions-url`: VehiclePositions
  feed (live geographic positions)
- `app.gtfs-rt.vehicle-positions-poll-cron`: cron, default
  every 15 s
- `app.gtfs-rt.timeout-seconds`: HTTP timeout per poll;
  default 10

##### Translations (optional)

- `app.translations.preferred-language`: ISO 639 code the
  kiosk fleet should display (`fr`, `en`, …). Falls back
  to the GTFS feed's default language when unset.

#### Development Profile (default)

```yaml
spring:
  datasource:
    url: jdbc:h2:mem:transitdb;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    driver-class-name: org.h2.Driver
  h2:
    console:
      enabled: true
      path: /h2-console
  flyway:
    enabled: false

app:
  jwt:
    secret: dev-secret-key-...
    expiration-hours: 8
```

H2 console accessible at <http://localhost:8080/h2-console>

#### Production Profile

```yaml
spring:
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/transit}
    username: ${DATABASE_USER:transit}
    password: ${DATABASE_PASSWORD:transit}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
  flyway:
    enabled: true
    baseline-on-migrate: true

app:
  jwt:
    secret: ${JWT_SECRET}
    expiration-hours: 8
```

### Frontend - proxy.conf.json

The development proxy redirects API calls to the backend:

```json
{
  "/api": { "target": "http://localhost:8080" },
  "/ws": { "target": "http://localhost:8080", "ws": true }
}
```

## Verifying the Installation

### 1. Test the Backend

```bash
# Check that the API responds
curl http://localhost:8080/actuator/health

# Expected response:
# {"status":"UP"}
```

### 2. Test Authentication

```bash
# Log in
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Response with JWT token
```

### 3. Access the Interface

1. Open <http://localhost:4200>
2. Log in with admin / admin123
3. The dashboard should appear

## Troubleshooting

### Backend Won't Start

#### Error: Port 8080 already in use

```bash
# Find the process
lsof -i :8080
# Kill the process or use a different port
./gradlew bootRun --args='--server.port=8081'
```

#### Error: Incorrect Java version

```bash
# Check the version
java --version
# Install Java 21 with SDKMAN
sdk install java 21.0.5-tem
sdk use java 21.0.5-tem
```

### Frontend Won't Compile

#### Error: Modules not found

```bash
# Delete node_modules and reinstall
rm -rf node_modules package-lock.json
npm install
```

#### Error: Incorrect Node.js version

```bash
# Check the version
node --version
# Use nvm to switch versions
nvm install 20
nvm use 20
```

### API Connection Issues

#### CORS Error

- Check that the Angular proxy is configured
- In dev, `/api/*` requests are redirected to the backend

#### 401 Unauthorized Error

- The JWT token has expired (validity: 8 hours)
- The token is missing or invalid
- Log in again to get a new token
- The API returns a structured JSON response (not HTML)

#### 403 Forbidden Error

- Insufficient permissions to access the endpoint
- The user does not have the required role
  (e.g., ADMIN endpoint for an AGENT)
- A notification is displayed in the frontend
