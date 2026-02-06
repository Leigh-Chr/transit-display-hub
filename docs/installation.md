# Guide d'installation

## Prérequis système

### Backend
- **Java** : JDK 21 ou supérieur
- **Gradle** : 8.x+ (wrapper inclus)

### Frontend
- **Node.js** : 20.x ou supérieur
- **npm** : 10.x ou supérieur

### Base de données (Production)
- **PostgreSQL** : 15.x ou supérieur

## Installation pour le développement

### 1. Cloner le repository

```bash
git clone <repository-url>
cd transit-display-hub
```

### 2. Configuration du Backend

```bash
cd backend
```

#### Avec SDKMAN (recommandé pour Java)

```bash
# Installer SDKMAN si nécessaire
curl -s "https://get.sdkman.io" | bash
source ~/.sdkman/bin/sdkman-init.sh

# Installer Java 21
sdk install java 21.0.5-tem
```

#### Vérifier l'installation

```bash
java --version
# Doit afficher: openjdk 21.x.x
```

#### Démarrer le backend

```bash
./gradlew bootRun
```

Le serveur démarre sur http://localhost:8080

### 3. Configuration du Frontend

```bash
cd frontend
npm install
```

#### Démarrer le frontend

```bash
npm start
```

L'application démarre sur http://localhost:4200

## Configuration

### Backend - application.yml

Le fichier de configuration se trouve dans `backend/src/main/resources/application.yml`.

#### Variables d'environnement

| Variable | Description | Défaut |
|----------|-------------|--------|
| `SPRING_PROFILES_ACTIVE` | Profil actif (dev, prod) | dev |
| `DATABASE_URL` | URL de connexion PostgreSQL | `jdbc:postgresql://localhost:5432/transit` |
| `DATABASE_USER` | Utilisateur PostgreSQL | `transit` |
| `DATABASE_PASSWORD` | Mot de passe PostgreSQL | `transit` |
| `JWT_SECRET` | Clé secrète JWT (min 256 bits) | (obligatoire en prod) |

#### Profil développement (défaut)

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

Console H2 accessible sur http://localhost:8080/h2-console

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

Le proxy de développement redirige les appels API vers le backend :

```json
{
  "/api": { "target": "http://localhost:8080" },
  "/ws": { "target": "http://localhost:8080", "ws": true }
}
```

## Vérification de l'installation

### 1. Tester le backend

```bash
# Vérifier que l'API répond
curl http://localhost:8080/actuator/health

# Réponse attendue:
# {"status":"UP"}
```

### 2. Tester l'authentification

```bash
# Se connecter
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}'

# Réponse avec token JWT
```

### 3. Accéder à l'interface

1. Ouvrir http://localhost:4200
2. Se connecter avec admin / admin123
3. Le dashboard doit s'afficher

## Résolution des problèmes

### Le backend ne démarre pas

**Erreur : Port 8080 déjà utilisé**
```bash
# Trouver le processus
lsof -i :8080
# Tuer le processus ou utiliser un autre port
./gradlew bootRun --args='--server.port=8081'
```

**Erreur : Java version incorrecte**
```bash
# Vérifier la version
java --version
# Installer Java 21 avec SDKMAN
sdk install java 21.0.5-tem
sdk use java 21.0.5-tem
```

### Le frontend ne compile pas

**Erreur : Modules non trouvés**
```bash
# Supprimer node_modules et réinstaller
rm -rf node_modules package-lock.json
npm install
```

**Erreur : Version Node.js incorrecte**
```bash
# Vérifier la version
node --version
# Utiliser nvm pour changer de version
nvm install 20
nvm use 20
```

### Problèmes de connexion API

**Erreur CORS**
- Vérifier que le proxy Angular est configuré
- En dev, les requêtes `/api/*` sont redirigées vers le backend

**Erreur 401 Unauthorized**
- Le token JWT a expiré (durée de validité : 8 heures)
- Se reconnecter pour obtenir un nouveau token
