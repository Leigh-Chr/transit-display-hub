# Guide de Deploiement

## Prerequis

### Serveur

- **OS** : Linux (Ubuntu 22.04+, Debian 11+, RHEL 8+)
- **RAM** : 2 Go minimum, 4 Go recommande
- **CPU** : 2 cores minimum
- **Disque** : 20 Go minimum

### Logiciels

- Java 21 JRE
- PostgreSQL 15+
- Nginx (reverse proxy)
- Docker (optionnel)

---

## Option 1 : Deploiement manuel

### 1. Preparer la base de donnees

```sql
-- Se connecter a PostgreSQL
-- sudo -u postgres psql

-- Creer l'utilisateur et la base
CREATE USER transit WITH PASSWORD 'your-secure-password';
CREATE DATABASE transitdb OWNER transit;
GRANT ALL PRIVILEGES ON DATABASE transitdb TO transit;
\q
```

### 2. Build du backend

```bash
cd backend
./gradlew build -x test

# Le JAR est dans build/libs/
ls build/libs/transit-display-hub-*.jar
```

### 3. Build du frontend

```bash
cd frontend
npm install
npm run build -- --configuration=production

# Les fichiers sont dans dist/transit-display-hub/
```

### 4. Configuration du backend

Creer le fichier `/opt/transit-hub/application-prod.yml` :

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

### 5. Service systemd

Creer `/etc/systemd/system/transit-hub.service` :

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
# Recharger systemd
sudo systemctl daemon-reload

# Demarrer le service
sudo systemctl start transit-hub
sudo systemctl enable transit-hub

# Verifier le status
sudo systemctl status transit-hub
```

### 6. Configuration Nginx

Creer `/etc/nginx/sites-available/transit-hub` :

```nginx
server {
    listen 80;
    server_name transit.example.com;

    # Redirection HTTPS
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

    # Actuator (restreint)
    location /actuator/ {
        allow 10.0.0.0/8;
        deny all;
        proxy_pass http://localhost:8080;
    }
}
```

```bash
# Activer le site
sudo ln -s /etc/nginx/sites-available/transit-hub \
  /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Deployer le frontend

```bash
# Copier les fichiers
sudo cp -r frontend/dist/transit-display-hub/* \
  /var/www/transit-hub/
sudo chown -R www-data:www-data /var/www/transit-hub
```

---

## Option 2 : Deploiement Docker

### Dockerfile Backend

`backend/Dockerfile` :

```dockerfile
FROM eclipse-temurin:21-jre-alpine

WORKDIR /app

COPY build/libs/transit-display-hub-*.jar app.jar

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "app.jar"]
```

### Dockerfile Frontend

`frontend/Dockerfile` :

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

`docker-compose.yml` :

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
# Build et demarrage
docker-compose build
docker-compose up -d

# Verifier les logs
docker-compose logs -f
```

---

## Migrations de base de donnees

### Flyway (recommande pour production)

Flyway est deja inclus dans les dependances du projet
(`flyway-core` et `flyway-database-postgresql`). En
profil `prod`, les migrations s'executent automatiquement
au demarrage avec `baseline-on-migrate: true`.

Structure des migrations :

```text
src/main/resources/db/migration/
+-- V1__create_lines_table.sql
+-- V2__create_stops_table.sql
+-- V3__create_schedules_table.sql
+-- V4__create_itineraries_table.sql
+-- ...
```

### Execution des migrations

Les migrations sont appliquees automatiquement au
demarrage en profil prod. En profil dev, Flyway est
desactive (DDL gere par Hibernate `create-drop`).

---

## Securite en production

### 1. Variables d'environnement

Ne jamais stocker les secrets dans les fichiers de
config :

```bash
# Fichier .env (non versionne)
DATABASE_URL=jdbc:postgresql://localhost:5432/transitdb
DATABASE_USER=transit
DATABASE_PASSWORD=super-secret-password
JWT_SECRET=256-bit-secret-key-at-least-32-chars
```

### 2. Certificat SSL

```bash
# Avec Let's Encrypt
sudo certbot --nginx -d transit.example.com
```

### 3. Pare-feu

```bash
# UFW
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

### 4. Mises a jour automatiques

```bash
# Ubuntu/Debian
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Monitoring

### Health Check

```bash
# Verifier la sante de l'application
curl https://transit.example.com/actuator/health
```

### Logs

```bash
# Backend (systemd)
sudo journalctl -u transit-hub -f

# Backend (Docker)
docker logs -f transit-hub-backend-1
```

### Metriques

Endpoints Actuator disponibles :

- `/actuator/health` - Etat de sante
- `/actuator/info` - Informations application
- `/actuator/metrics` - Metriques (Prometheus compatible)

---

## Sauvegarde

### Base de donnees (sauvegarde)

```bash
# Backup
pg_dump -U transit transitdb > backup_$(date +%Y%m%d).sql

# Restore
psql -U transit transitdb < backup_20260201.sql
```

### Script de backup automatique

```bash
#!/bin/bash
# /opt/scripts/backup.sh

BACKUP_DIR="/opt/backups"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup PostgreSQL
pg_dump -U transit transitdb \
  | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Nettoyer les backups > 30 jours
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

```bash
# Cron (tous les jours a 3h)
0 3 * * * /opt/scripts/backup.sh
```

---

## Rollback

### Revenir a une version precedente

```bash
# Arreter le service
sudo systemctl stop transit-hub

# Restaurer le JAR precedent
cp /opt/transit-hub/backup/transit-display-hub-old.jar \
  /opt/transit-hub/transit-display-hub.jar

# Restaurer la base si necessaire
psql -U transit transitdb < backup_previous.sql

# Redemarrer
sudo systemctl start transit-hub
```

---

## Checklist de deploiement

- [ ] Base de donnees creee et configuree
- [ ] Variables d'environnement definies
- [ ] Backend builde et deploye
- [ ] Frontend builde et deploye
- [ ] Nginx configure avec SSL
- [ ] Service systemd active
- [ ] Health check fonctionnel
- [ ] Backup automatique configure
- [ ] Monitoring en place
- [ ] Pare-feu configure
