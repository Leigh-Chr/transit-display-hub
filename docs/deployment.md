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
npm run build -- --configuration=production

# Files are in dist/transit-display-hub/
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

server:
  port: 8080
```

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

### 6. Nginx Configuration

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

    # API Backend
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

### 7. Deploy the Frontend

```bash
# Copy the files
sudo cp -r frontend/dist/transit-display-hub/* \
  /var/www/transit-hub/
sudo chown -R www-data:www-data /var/www/transit-hub
```

---

## Option 2: Docker Deployment

### Backend Dockerfile

`backend/Dockerfile`:

```dockerfile
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY build/libs/transit-display-hub-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Frontend Dockerfile

`frontend/Dockerfile`:

```dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build -- --configuration=production

FROM nginx:alpine
COPY --from=build /app/dist/transit-display-hub \
  /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
```

### Docker Compose

`docker-compose.yml`:

```yaml
version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: transitdb
      POSTGRES_USER: transit
      POSTGRES_PASSWORD: ${DATABASE_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - transit-network

  backend:
    build: ./backend
    environment:
      SPRING_PROFILES_ACTIVE: prod
      DATABASE_URL: jdbc:postgresql://postgres:5432/transitdb
      DATABASE_USER: transit
      DATABASE_PASSWORD: ${DATABASE_PASSWORD}
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
    networks:
      - transit-network

  frontend:
    build: ./frontend
    ports:
      - "80:80"
    depends_on:
      - backend
    networks:
      - transit-network

volumes:
  postgres_data:

networks:
  transit-network:
    driver: bridge
```

```bash
# Build and start
docker-compose build
docker-compose up -d

# Check logs
docker-compose logs -f
```

---

## Database Migrations

### Flyway (recommended for production)

Flyway is already included in the project dependencies
(`flyway-core` and `flyway-database-postgresql`). In
`prod` profile, migrations run automatically on startup
with `baseline-on-migrate: true`.

Migration structure:

```text
src/main/resources/db/migration/
+-- V1__create_lines_table.sql
+-- V2__create_stops_table.sql
+-- V3__create_schedules_table.sql
+-- V4__create_itineraries_table.sql
+-- ...
```

### Running Migrations

Migrations are applied automatically on startup in prod
profile. In dev profile, Flyway is disabled (DDL managed
by Hibernate `create-drop`).

---

## Production Security

### 1. Environment Variables

Never store secrets in configuration files:

```bash
# .env file (not versioned)
DATABASE_URL=jdbc:postgresql://localhost:5432/transitdb
DATABASE_USER=transit
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
docker logs -f transit-hub-backend-1
```

### Metrics

Available Actuator endpoints:

- `/actuator/health` - Health status
- `/actuator/info` - Application information
- `/actuator/metrics` - Metrics (Prometheus compatible)

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
