# Guide d'installation

## Prerequis systeme

### Backend (prerequis)

- **Java** : JDK 21 ou superieur
- **Gradle** : 8.x+ (wrapper inclus)

### Frontend (prerequis)

- **Node.js** : 20.x ou superieur
- **npm** : 10.x ou superieur

### Base de donnees (Production)

- **PostgreSQL** : 15.x ou superieur

## Installation pour le developpement

### 1. Cloner le repository

```bash
git clone <repository-url>
cd transit-display-hub
```

### 2. Configuration du Backend

```bash
cd backend
```

#### Avec SDKMAN (recommande pour Java)

```bash
# Installer SDKMAN si necessaire
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh

# Installer Java 21
sdk install java 21.0.5-tem
```

#### Verifier l'installation

```bash
java --version
# Doit afficher: openjdk 21.x.x
```

#### Demarrer le backend

```bash
./gradlew bootRun
```

Le serveur demarre sur <http://localhost:8080>

### 3. Configuration du Frontend

```bash
cd frontend
npm install
```

#### Demarrer le frontend

```bash
npm start
```

L'application demarre sur <http://localhost:4200>

## Configuration

### Backend - application.yml

Le fichier de configuration se trouve dans
`backend/src/main/resources/application.yml`.

#### Variables d'environnement

- `SPRING_PROFILES_ACTIVE` : Profil actif (dev, prod).
  Defaut : `dev`
- `DATABASE_URL` : URL de connexion PostgreSQL.
  Defaut : `jdbc:postgresql://localhost:5432/transit`
- `DATABASE_USER` : Utilisateur PostgreSQL.
  Defaut : `transit`
- `DATABASE_PASSWORD` : Mot de passe PostgreSQL.
  Defaut : `transit`
- `JWT_SECRET` : Cle secrete JWT (min 256 bits).
  Obligatoire en prod

#### Profil developpement (defaut)

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

Console H2 accessible sur <http://localhost:8080/h2-console>

#### Profil production

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

Le proxy de developpement redirige les appels API vers
le backend :

```json
{
  "/api": { "target": "http://localhost:8080" },
  "/ws": { "target": "http://localhost:8080", "ws": true }
}
```

## Verification de l'installation

### 1. Tester le backend

```bash
# Verifier que l'API repond
curl http://localhost:8080/actuator/health

# Reponse attendue:
# {"status":"UP"}
```

### 2. Tester l'authentification

```bash
# Se connecter
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Reponse avec token JWT
```

### 3. Acceder a l'interface

1. Ouvrir <http://localhost:4200>
2. Se connecter avec admin / admin123
3. Le dashboard doit s'afficher

## Resolution des problemes

### Le backend ne demarre pas

#### Erreur : Port 8080 deja utilise

```bash
# Trouver le processus
lsof -i :8080
# Tuer le processus ou utiliser un autre port
./gradlew bootRun --args='--server.port=8081'
```

#### Erreur : Java version incorrecte

```bash
# Verifier la version
java --version
# Installer Java 21 avec SDKMAN
sdk install java 21.0.5-tem
sdk use java 21.0.5-tem
```

### Le frontend ne compile pas

#### Erreur : Modules non trouves

```bash
# Supprimer node_modules et reinstaller
rm -rf node_modules package-lock.json
npm install
```

#### Erreur : Version Node.js incorrecte

```bash
# Verifier la version
node --version
# Utiliser nvm pour changer de version
nvm install 20
nvm use 20
```

### Problemes de connexion API

#### Erreur CORS

- Verifier que le proxy Angular est configure
- En dev, les requetes `/api/*` sont redirigees vers
  le backend

#### Erreur 401 Unauthorized

- Le token JWT a expire (duree de validite : 8 heures)
- Le token est manquant ou invalide
- Se reconnecter pour obtenir un nouveau token
- L'API retourne une reponse JSON structuree
  (pas du HTML)

#### Erreur 403 Forbidden

- Permissions insuffisantes pour acceder a l'endpoint
- L'utilisateur n'a pas le role requis
  (ex: endpoint ADMIN pour un AGENT)
- Une notification s'affiche dans le frontend
