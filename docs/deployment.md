# Deployment Guide

## Prerequisites

### Server

- **OS**: Linux (Ubuntu 22.04+, Debian 11+, RHEL 8+)
- **RAM**: 2 GB minimum, 4 GB recommended
- **CPU**: 2 cores minimum
- **Disk**: 20 GB minimum

### Software

- Java 21 JRE
- PostgreSQL 15+
- Nginx (reverse proxy)
- Docker (optional)

---

## Option 1: Manual Deployment

### 1. Prepare the Database

```sql
-- Connect to PostgreSQL
-- sudo -u postgres psql

-- Create the user and database
CREATE USER transit WITH PASSWORD 'your-secure-password';
CREATE DATABASE transitdb OWNER transit;
GRANT ALL PRIVILEGES ON DATABASE transitdb TO transit;
\q
```

### 2. Build the Backend

```bash
cd backend
./gradlew build -x test

# The JAR is in build/libs/
ls build/libs/transit-display-hub-*.jar
```

### 3. Build the Frontend

```bash
cd frontend
npm install
npm run build

# Files are in dist/transit-display-hub/browser/
```

### 4. Backend Configuration

Create the file `/opt/transit-hub/application-prod.yml`:

```yaml
spring:
  profiles:
    active: prod
  datasource:
    url: ${DATABASE_URL:jdbc:postgresql://localhost:5432/transitdb}
    username: ${DATABASE_USER:transit}
    password: ${DATABASE_PASSWORD}
    driver-class-name: org.postgresql.Driver
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false
  flyway:
    enabled: true
    baseline-on-migrate: true

app:
  jwt:
    secret: ${JWT_SECRET}
    expiration-hours: 8
    refresh-expiration-days: ${JWT_REFRESH_EXPIRATION_DAYS:14}
  auth:
    cookie-secure: ${AUTH_COOKIE_SECURE:true}
    cookie-same-site: ${AUTH_COOKIE_SAME_SITE:Strict}

server:
  port: 8080
```

> **HTTPS is mandatory in prod.** `AUTH_COOKIE_SECURE=true` (the
> default once the prod profile is active) means the cookies will
> not ride over plain HTTP. The Nginx block below terminates TLS
> and proxies plain HTTP to the backend on the loopback interface,
> which is the supported topology.

### 5. Systemd Service

Create `/etc/systemd/system/transit-hub.service`:

```ini
[Unit]
Description=Transit Display Hub Backend
After=network.target postgresql.service

[Service]
Type=simple
User=transit
Group=transit
WorkingDirectory=/opt/transit-hub
ExecStart=/usr/bin/java -jar transit-display-hub.jar --spring.config.location=file:./application-prod.yml
Restart=always
RestartSec=10

Environment=DATABASE_URL=jdbc:postgresql://localhost:5432/transitdb
Environment=DATABASE_USER=transit
Environment=DATABASE_PASSWORD=your-secure-password
Environment=JWT_SECRET=your-256-bit-secret-key-minimum-32-characters
Environment=JWT_REFRESH_EXPIRATION_DAYS=14
Environment=AUTH_COOKIE_SECURE=true
Environment=AUTH_COOKIE_SAME_SITE=Strict

[Install]
WantedBy=multi-user.target
```

```bash
# Reload systemd
sudo systemctl daemon-reload

# Start the service
sudo systemctl start transit-hub
sudo systemctl enable transit-hub

# Check the status
sudo systemctl status transit-hub
```

### 6. First Login

On first startup, Flyway creates the database schema and seeds a default admin user:

- **Username**: `admin`
- **Password**: `admin123`

> **Important**: Change this password immediately after first login via the Users management page.

### 7. Nginx Configuration

Create `/etc/nginx/sites-available/transit-hub`:

```nginx
server {
    listen 80;
    server_name transit.example.com;

    # HTTPS redirect
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name transit.example.com;

    ssl_certificate /etc/letsencrypt/live/transit.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/transit.example.com/privkey.pem;

    # Frontend
    root /var/www/transit-hub;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # API Backend — preserves cookies (Set-Cookie + Cookie headers)
    # and the X-XSRF-TOKEN header round-trip needed by the
    # cookie-based session (ADR 0039).
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_read_timeout 86400;
    }

    # Actuator (restricted)
    location /actuator/ {
        allow 10.0.0.0/8;
        deny all;
        proxy_pass http://localhost:8080;
    }
}
```

```bash
# Enable the site
sudo ln -s /etc/nginx/sites-available/transit-hub \
  /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 8. Deploy the Frontend

```bash
# Copy the files
sudo cp -r frontend/dist/transit-display-hub/browser/* \
  /var/www/transit-hub/
sudo chown -R www-data:www-data /var/www/transit-hub
```

---

## Option 2: Docker Deployment

The repository includes ready-to-use Docker configuration:

- `backend/Dockerfile` — Multi-stage build (JDK for compilation, JRE for runtime, non-root user)
- `frontend/Dockerfile` — Multi-stage build (Node for compilation, nginx for serving)
- `frontend/nginx.conf` — SPA fallback, API/WebSocket proxy, gzip, cache headers
- `docker-compose.yml` — PostgreSQL + backend + frontend with healthchecks
- `ops/kiosk/docker-compose.kiosk.yml` — same three services
  pre-tuned for a single-host kiosk (Raspberry Pi 4+,
  x86 mini-PC). See [Option 3](#option-3-raspberry-pi-kiosk).

### Quick Start

```bash
# 1. Create your .env from the template
cp .env.example .env

# 2. Edit .env with your secrets
#    - DATABASE_PASSWORD: a strong password
#    - JWT_SECRET: at least 32 characters

# 3. Build and start all services
docker compose up --build -d

# 4. Check logs
docker compose logs -f

# 5. Open http://localhost in your browser
#    Default login: admin / admin123 (change immediately)
```

### Service Details

| Service    | Image              | Port | Notes                              |
|------------|--------------------| ---- |------------------------------------|
| `postgres` | postgres:17-alpine | 5432 | Persistent volume, healthcheck     |
| `backend`  | custom (Spring Boot) | 8080 | Waits for postgres healthy         |
| `frontend` | custom (nginx)     | 80   | Proxies `/api/` and `/ws` to backend |

### Useful Commands

```bash
# Rebuild a single service
docker compose build backend

# View backend logs
docker compose logs -f backend

# Stop everything
docker compose down

# Stop and remove data volume
docker compose down -v
```

---

## Option 3: Raspberry Pi kiosk

Single-host deployment for a Pi 4 (or any Linux mini-PC)
turning the box into a fullscreen kiosk pointing at one
stop. Bootstraps Docker if missing, pulls the multi-arch
images, brings up PostgreSQL + backend + frontend, and
launches Chromium.

```bash
curl -fsSL https://raw.githubusercontent.com/Leigh-Chr/transit-display-hub/main/ops/kiosk/install.sh | bash
```

Customisation via environment variables before the
`curl | bash`:

- `GTFS_FEED_URL` — feed imported on first boot.
- `KIOSK_URL` — what Chromium points at (default
  `http://localhost`; pass
  `http://localhost/display/<stopId>` for a real kiosk).
- `KIOSK_BROWSER=none` — skip the auto-launch (headless
  servers).

Compose file: `ops/kiosk/docker-compose.kiosk.yml`.
Detailed guide: [`docs/kiosk-raspberry-pi.md`](kiosk-raspberry-pi.md).

---

## Database Migrations

### Flyway

Flyway is included in the project dependencies (`spring-boot-starter-flyway`). The migrations are at:

```
backend/src/main/resources/db/migration/
├── V1__initial_schema.sql              # Initial PostgreSQL schema
├── V2__seed_admin_user.sql             # Default admin user (admin / admin123)
├── V3..V23                              # Incremental growth: line metadata, transfers,
│                                        #   agencies, attributions, frequencies,
│                                        #   accessibility, pickup_type, feed_info, etc.
├── V24__service_calendars.sql           # Multi-day service calendars (ADR 0008)
├── V25__pathways_and_levels.sql         # Indoor topology (ADR 0009)
├── V26__add_translations.sql            # GTFS translations (ADR 0010)
├── V27__add_fares_v1.sql                # Fares v1 (ADR 0012)
├── V28__add_shapes.sql                  # Shapes / polylines (ADR 0014)
├── V29__add_location_groups_*.sql       # TAD location groups + booking rules (ADR 0015)
├── V30__add_fares_v2.sql                # Fares v2 core (ADR 0021)
├── V31__add_fares_v2_networks_*.sql     # Networks + fare media follow-up
├── V32..V34                              # Booking-rule wiring, per-platform stops,
│                                        #   fare-leg-join-rules
├── V35..V47                              # GTFS-spec coverage closure (CEMV support,
│                                        #   stop_access, rider categories, fare_transfer
│                                        #   boarding times, translation sub-id)
├── V48__add_itinerary_mean_duration.sql # GTFS-flex 2024 mean_duration_* fields
├── V49__add_import_audit_validation.sql # MobilityData validator outcome on the audit row
└── V50__refresh_tokens.sql               # Refresh tokens for cookie-based auth (ADR 0039)
```

The full per-migration story lives in the
[CHANGELOG](../CHANGELOG.md) and the matching ADRs.

- **Dev profile**: Flyway is disabled. Hibernate `create-drop` manages the schema, and the DataLoader seeds sample data (multiple users, lines, stops, etc.).
- **Prod profile**: Flyway runs automatically on startup with `baseline-on-migrate: true`. The DataLoader is disabled. Only the `admin` user is created by V2 migration.

> **Important**: Change the default admin password immediately after first login.

To add future migrations, create files following the naming convention `V35__description.sql`, `V36__description.sql`, etc. — never edit a migration that has already shipped.

---

## Production Security

### 1. Environment Variables

Never store secrets in configuration files:

```bash
# .env file (not versioned)
DATABASE_PASSWORD=super-secret-password
JWT_SECRET=256-bit-secret-key-at-least-32-chars
```

### 2. SSL Certificate

```bash
# With Let's Encrypt
sudo certbot --nginx -d transit.example.com
```

### 3. Firewall

```bash
# UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. Automatic Updates

```bash
# Ubuntu/Debian
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Monitoring

### Health Check

```bash
# Check application health
curl https://transit.example.com/actuator/health
```

### Logs

```bash
# Backend (systemd)
sudo journalctl -u transit-hub -f

# Backend (Docker)
docker compose logs -f backend
```

### Metrics

Available Actuator endpoints:

- `/actuator/health` — public, used by load balancer probes
- `/actuator/info` — **ADMIN-only since v1.2.0**; exposes the build version + git commit when `springBoot { buildInfo() }` is active
- `/actuator/metrics` — **ADMIN-only since v1.2.0**; raw Micrometer metrics
- `/actuator/prometheus` — **ADMIN-only since v1.5.0**; Prometheus scrape format. Configure the scraper to authenticate (basic-auth at the reverse proxy or a service-account JWT cookie attached to each scrape). The reverse-proxy ACL pattern below is still recommended as defence-in-depth on top of the auth requirement:

```nginx
location /actuator/prometheus {
    allow 10.0.0.0/8;     # internal Prometheus only
    deny all;
    proxy_pass http://backend:8080;
    # Pair with an Authorization header injected via a sidecar:
    # proxy_set_header Authorization "Bearer <service-account-token>";
}
```

---

## Backup

### Database Backup

```bash
# Backup
pg_dump -U transit transitdb > backup_$(date +%Y%m%d).sql

# Restore
psql -U transit transitdb < backup_20260201.sql
```

### Automated Backup Script

```bash
#!/bin/bash
# /opt/scripts/backup.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# PostgreSQL backup
pg_dump -U transit transitdb \
  | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Clean up backups older than 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

```bash
# Cron (daily at 3 AM)
0 3 * * * /opt/scripts/backup.sh
```

---

## Rollback

### Revert to a Previous Version

```bash
# Stop the service
sudo systemctl stop transit-hub

# Restore the previous JAR
cp /opt/transit-hub/backup/transit-display-hub-old.jar \
  /opt/transit-hub/transit-display-hub.jar

# Restore the database if needed
psql -U transit transitdb < backup_previous.sql

# Restart
sudo systemctl start transit-hub
```

---

## Deployment Checklist

- [ ] Database created and configured
- [ ] Environment variables defined
- [ ] Backend built and deployed
- [ ] Frontend built and deployed
- [ ] Nginx configured with SSL
- [ ] Systemd service enabled
- [ ] Health check working
- [ ] Automated backup configured
- [ ] Monitoring in place
- [ ] Firewall configured
