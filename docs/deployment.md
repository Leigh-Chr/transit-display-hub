# Guide de Déploiement

## Prérequis

### Serveur
- **OS** : Linux (Ubuntu 22.04+, Debian 11+, RHEL 8+)
- **RAM** : 2 Go minimum, 4 Go recommandé
- **CPU** : 2 cores minimum
- **Disque** : 20 Go minimum

### Logiciels
- Java 21 JRE
- PostgreSQL 15+
- Nginx (reverse proxy)
- Docker (optionnel)

---

## Option 1 : Déploiement manuel

### 1. Préparer la base de données

```bash
# Se connecter à PostgreSQL
sudo -u postgres psql

# Créer l'utilisateur et la base
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

Créer le fichier `/opt/transit-hub/application-prod.yml` :

```yaml
spring:
  profiles:
    active: prod
  datasource:
    url: jdbc:postgresql://localhost:5432/transitdb
    username: transit
    password: ${DATABASE_PASSWORD}
  jpa:
    hibernate:
      ddl-auto: validate
    show-sql: false

jwt:
  secret: ${JWT_SECRET}
  expiration: 86400000

server:
  port: 8080
```

### 5. Service systemd

Créer `/etc/systemd/system/transit-hub.service` :

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

Environment=DATABASE_PASSWORD=your-secure-password
Environment=JWT_SECRET=your-256-bit-secret-key-minimum-32-characters

[Install]
WantedBy=multi-user.target
```

```bash
# Recharger systemd
sudo systemctl daemon-reload

# Démarrer le service
sudo systemctl start transit-hub
sudo systemctl enable transit-hub

# Vérifier le status
sudo systemctl status transit-hub
```

### 6. Configuration Nginx

Créer `/etc/nginx/sites-available/transit-hub` :

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
sudo ln -s /etc/nginx/sites-available/transit-hub /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 7. Déployer le frontend

```bash
# Copier les fichiers
sudo cp -r frontend/dist/transit-display-hub/* /var/www/transit-hub/
sudo chown -R www-data:www-data /var/www/transit-hub
```

---

## Option 2 : Déploiement Docker

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
COPY --from=build /app/dist/transit-display-hub /usr/share/nginx/html
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
      SPRING_DATASOURCE_URL: jdbc:postgresql://postgres:5432/transitdb
      SPRING_DATASOURCE_USERNAME: transit
      SPRING_DATASOURCE_PASSWORD: ${DATABASE_PASSWORD}
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
# Build et démarrage
docker-compose build
docker-compose up -d

# Vérifier les logs
docker-compose logs -f
```

---

## Migrations de base de données

### Flyway (recommandé pour production)

Ajouter dans `build.gradle.kts` :

```kotlin
implementation("org.flywaydb:flyway-core")
```

Structure des migrations :

```
src/main/resources/db/migration/
├── V1__create_lines_table.sql
├── V2__create_stops_table.sql
├── V3__create_timed_entries_table.sql
└── ...
```

### Exécution des migrations

```bash
# Automatique au démarrage
./gradlew bootRun

# Ou manuellement
./gradlew flywayMigrate
```

---

## Sécurité en production

### 1. Variables d'environnement

Ne jamais stocker les secrets dans les fichiers de config :

```bash
# Fichier .env (non versionné)
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

### 4. Mises à jour automatiques

```bash
# Ubuntu/Debian
sudo apt install unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades
```

---

## Monitoring

### Health Check

```bash
# Vérifier la santé de l'application
curl https://transit.example.com/actuator/health
```

### Logs

```bash
# Backend (systemd)
sudo journalctl -u transit-hub -f

# Backend (Docker)
docker logs -f transit-hub-backend-1
```

### Métriques

Endpoints Actuator disponibles :
- `/actuator/health` - État de santé
- `/actuator/info` - Informations application
- `/actuator/metrics` - Métriques (Prometheus compatible)

---

## Sauvegarde

### Base de données

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
pg_dump -U transit transitdb | gzip > $BACKUP_DIR/db_$DATE.sql.gz

# Nettoyer les backups > 30 jours
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

```bash
# Cron (tous les jours à 3h)
0 3 * * * /opt/scripts/backup.sh
```

---

## Rollback

### Revenir à une version précédente

```bash
# Arrêter le service
sudo systemctl stop transit-hub

# Restaurer le JAR précédent
cp /opt/transit-hub/backup/transit-display-hub-old.jar /opt/transit-hub/transit-display-hub.jar

# Restaurer la base si nécessaire
psql -U transit transitdb < backup_previous.sql

# Redémarrer
sudo systemctl start transit-hub
```

---

## Checklist de déploiement

- [ ] Base de données créée et configurée
- [ ] Variables d'environnement définies
- [ ] Backend buildé et déployé
- [ ] Frontend buildé et déployé
- [ ] Nginx configuré avec SSL
- [ ] Service systemd activé
- [ ] Health check fonctionnel
- [ ] Backup automatique configuré
- [ ] Monitoring en place
- [ ] Pare-feu configuré
