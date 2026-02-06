# Documentation API

## Vue d'ensemble

L'API REST de Transit Display Hub fournit les endpoints pour gérer le réseau de transport, les itinéraires, les horaires, les messages broadcast, les appareils, les utilisateurs et l'affichage temps réel.

**URL de base** : `http://localhost:8080/api`

## Authentification

### JWT Token

L'API utilise l'authentification JWT (JSON Web Token). Le token doit être inclus dans le header `Authorization` pour toutes les requêtes protégées.

```
Authorization: Bearer <token>
```

### Login

```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "admin",
  "password": "admin123"
}
```

**Réponse** (200 OK) :
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-02-02T13:00:00Z",
  "role": "ADMIN",
  "username": "admin"
}
```

### Permissions par endpoint

| Endpoint | Accès |
|----------|-------|
| `/api/auth/**` | Public |
| `/api/display/**` | Public |
| `/api/network-map/**` | Public |
| `/api/device/authenticate` | Public |
| `GET /api/itineraries/**` | Public |
| `GET /api/v2/stops/*/schedules` | Public |
| `/api/messages/**` | Admin, Agent |
| `GET /api/lines/**`, `GET /api/stops/**` | Admin, Agent |
| `/api/lines/**`, `/api/stops/**` (POST, PUT, DELETE) | Admin |
| `/api/v2/**` (POST, PUT, DELETE) | Admin |
| `/api/itineraries/**` (POST, PUT, DELETE) | Admin |
| `/api/devices/**`, `/api/users/**` | Admin |

---

## Lignes

### Lister les lignes

```http
GET /api/lines
Authorization: Bearer <token>
```

**Paramètres de pagination** (optionnels) :
- `page` : Numéro de page (0-indexed, active la pagination)
- `size` : Taille de page (défaut : 10)
- `sortBy` : Champ de tri (défaut : `code`)
- `sortDir` : Direction du tri (`asc` ou `desc`, défaut : `asc`)
- `search` : Recherche textuelle

**Réponse sans pagination** (200 OK) :
```json
[
  {
    "id": "uuid",
    "code": "M1",
    "name": "Métro Ligne 1",
    "color": "#3B82F6",
    "type": "METRO",
    "stopCount": 12,
    "itineraryCount": 2
  }
]
```

**Réponse avec pagination** (200 OK) :
```json
{
  "content": [...],
  "page": 0,
  "size": 10,
  "totalElements": 25,
  "totalPages": 3
}
```

### Obtenir une ligne

```http
GET /api/lines/{id}
Authorization: Bearer <token>
```

### Créer une ligne

```http
POST /api/lines
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "M2",
  "name": "Métro Ligne 2",
  "color": "#10B981",
  "type": "METRO"
}
```

**Champs** :
- `code` (requis) : Identifiant court, max 10 caractères, unique
- `name` (requis) : Nom complet, max 100 caractères
- `color` (requis) : Couleur hexadécimale (ex: `#FF5733`)
- `type` (optionnel) : Type de ligne (`METRO`, `BUS`, `TRAM`, `TRAIN`)

**Réponse** (201 Created)

### Modifier une ligne

```http
PUT /api/lines/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "M2",
  "name": "Métro Ligne 2 - Express",
  "color": "#059669",
  "type": "METRO"
}
```

### Supprimer une ligne

```http
DELETE /api/lines/{id}
Authorization: Bearer <token>
```

**Réponse** (204 No Content)

> **Attention** : Supprimer une ligne supprime également ses itinéraires et horaires associés.

---

## Arrêts

### Lister les arrêts

```http
GET /api/stops
GET /api/stops?lineId={lineId}
Authorization: Bearer <token>
```

**Paramètres** :
- `lineId` (optionnel) : Filtrer par ligne
- `page`, `size`, `sortBy`, `sortDir`, `search` : Pagination (même format que les lignes, tri par défaut : `name`)

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "name": "Gare Centrale",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "schematicX": 150.0,
    "schematicY": 200.0,
    "lines": [
      { "id": "uuid", "code": "M1", "name": "Métro Ligne 1", "color": "#3B82F6" }
    ],
    "scheduleCount": 24,
    "hasDevice": true
  }
]
```

### Créer un arrêt

```http
POST /api/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Place du Marché",
  "lineIds": ["line-uuid-1", "line-uuid-2"],
  "latitude": 48.8580,
  "longitude": 2.3540
}
```

**Champs** :
- `name` (requis) : Nom de l'arrêt, max 100 caractères
- `lineIds` (requis) : Ensemble d'IDs de lignes (au moins une)
- `latitude` (optionnel) : Coordonnée GPS
- `longitude` (optionnel) : Coordonnée GPS

### Modifier un arrêt

```http
PUT /api/stops/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Place du Marché - Centre",
  "lineIds": ["line-uuid-1"],
  "latitude": 48.8580,
  "longitude": 2.3540
}
```

### Supprimer un arrêt

```http
DELETE /api/stops/{id}
Authorization: Bearer <token>
```

---

## Itinéraires

Un itinéraire représente un parcours ordonné d'arrêts sur une ligne (ex: direction "Aéroport").

### Lister les itinéraires

```http
GET /api/itineraries
GET /api/itineraries?lineId={lineId}
```

> Les requêtes GET sont publiques (pas d'authentification requise).

**Paramètres** :
- `lineId` (optionnel) : Filtrer par ligne
- `page`, `size`, `sortBy`, `sortDir`, `search` : Pagination (tri par défaut : `name`)

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "name": "Direction Aéroport",
    "terminusName": "Aéroport",
    "line": {
      "id": "uuid",
      "code": "M1",
      "name": "Métro Ligne 1",
      "color": "#3B82F6"
    },
    "stops": [
      { "id": "stop-uuid", "name": "Gare Centrale", "position": 0 },
      { "id": "stop-uuid", "name": "Place du Marché", "position": 1 },
      { "id": "stop-uuid", "name": "Aéroport", "position": 2 }
    ]
  }
]
```

### Obtenir un itinéraire

```http
GET /api/itineraries/{id}
```

### Créer un itinéraire

```http
POST /api/itineraries
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "Direction Aéroport",
  "stopIds": ["stop-uuid-1", "stop-uuid-2", "stop-uuid-3"]
}
```

**Champs** :
- `lineId` (requis) : ID de la ligne
- `name` (requis) : Nom de l'itinéraire, max 100 caractères
- `stopIds` (optionnel) : Liste ordonnée d'IDs d'arrêts

**Réponse** (201 Created)

### Modifier un itinéraire

```http
PUT /api/itineraries/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "Direction Aéroport - Express"
}
```

### Supprimer un itinéraire

```http
DELETE /api/itineraries/{id}
Authorization: Bearer <token>
```

### Gérer les arrêts d'un itinéraire

**Remplacer tous les arrêts** :
```http
PUT /api/itineraries/{id}/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopIds": ["stop-uuid-1", "stop-uuid-2", "stop-uuid-3"]
}
```

**Ajouter un arrêt** :
```http
POST /api/itineraries/{id}/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "stop-uuid",
  "position": 2
}
```

**Retirer un arrêt** :
```http
DELETE /api/itineraries/{id}/stops/{stopId}
Authorization: Bearer <token>
```

---

## Horaires

Les horaires sont basés sur le modèle itinéraire : chaque horaire associe une heure de départ à un arrêt et un itinéraire.

### Lister les horaires d'un arrêt

```http
GET /api/v2/stops/{stopId}/schedules
```

> Cet endpoint est public.

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "time": "08:15",
    "stopId": "stop-uuid",
    "itinerary": {
      "id": "itinerary-uuid",
      "name": "Direction Aéroport",
      "terminusName": "Aéroport",
      "line": {
        "id": "line-uuid",
        "code": "M1",
        "name": "Métro Ligne 1",
        "color": "#3B82F6"
      }
    }
  }
]
```

### Créer un horaire

```http
POST /api/v2/stops/{stopId}/schedules
Authorization: Bearer <token>
Content-Type: application/json

{
  "time": "09:30",
  "itineraryId": "itinerary-uuid"
}
```

**Champs** :
- `time` (requis) : Heure de départ au format `HH:mm`
- `itineraryId` (requis) : ID de l'itinéraire (détermine la ligne et la direction)

### Modifier un horaire

```http
PUT /api/v2/schedules/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "time": "09:45",
  "itineraryId": "itinerary-uuid"
}
```

### Supprimer un horaire

```http
DELETE /api/v2/schedules/{id}
Authorization: Bearer <token>
```

---

## Messages Broadcast

### Lister les messages

```http
GET /api/messages
GET /api/messages?active=true
GET /api/messages?severity=CRITICAL
Authorization: Bearer <token>
```

**Paramètres** :
- `active` (optionnel) : `true` pour les messages actifs uniquement
- `severity` (optionnel) : Filtrer par sévérité (`INFO`, `WARNING`, `CRITICAL`)
- `page`, `size`, `sortBy`, `sortDir`, `search` : Pagination (tri par défaut : `startTime` desc)

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "title": "Travaux en cours",
    "content": "La ligne M1 est perturbée entre 10h et 14h.",
    "severity": "WARNING",
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z",
    "scopeType": "LINE",
    "scopeId": "line-uuid",
    "scopeInfo": {
      "name": "Métro Ligne 1",
      "lineCode": "M1",
      "lineColor": "#3B82F6"
    },
    "active": true
  }
]
```

### Créer un message

```http
POST /api/messages
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Service interrompu",
  "content": "Accident sur la voie. Service suspendu.",
  "severity": "CRITICAL",
  "startTime": "2026-02-01T15:00:00Z",
  "endTime": "2026-02-01T18:00:00Z",
  "scopeType": "STOP",
  "scopeId": "stop-uuid"
}
```

**Champs** :
- `title` (requis) : Titre, max 100 caractères
- `content` (requis) : Contenu, max 500 caractères
- `severity` (requis) : `INFO`, `WARNING` ou `CRITICAL`
- `startTime` (requis) : Date/heure de début (ISO 8601)
- `endTime` (requis) : Date/heure de fin (ISO 8601)
- `scopeType` (requis) : `NETWORK`, `LINE` ou `STOP`
- `scopeId` (optionnel) : ID de la ligne ou de l'arrêt (requis si scope LINE ou STOP)

### Modifier un message

```http
PUT /api/messages/{id}
Authorization: Bearer <token>
Content-Type: application/json
```

### Supprimer un message

```http
DELETE /api/messages/{id}
Authorization: Bearer <token>
```

---

## Appareils

### Lister les appareils

```http
GET /api/devices
GET /api/devices?status=ONLINE
Authorization: Bearer <token>
```

**Paramètres** :
- `status` (optionnel) : `ONLINE` ou `OFFLINE`

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "stopId": "stop-uuid",
    "stopName": "Gare Centrale",
    "lines": [
      { "code": "M1", "name": "Métro Ligne 1", "color": "#3B82F6" }
    ],
    "status": "ONLINE",
    "lastHeartbeat": "2026-02-01T12:30:00Z"
  }
]
```

### Obtenir un appareil

```http
GET /api/devices/{id}
Authorization: Bearer <token>
```

### Enregistrer un appareil

```http
POST /api/devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "stop-uuid"
}
```

**Réponse** (201 Created) :
```json
{
  "id": "device-uuid",
  "token": "generated-token-to-save",
  "stopId": "stop-uuid",
  "stopName": "Gare Centrale"
}
```

> **Important** : Le `token` n'est affiché qu'une seule fois. Il doit être configuré sur l'appareil.

### Modifier un appareil

```http
PUT /api/devices/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "new-stop-uuid"
}
```

### Supprimer un appareil

```http
DELETE /api/devices/{id}
Authorization: Bearer <token>
```

### Authentifier un appareil

```http
POST /api/device/authenticate
Content-Type: application/json

{
  "token": "device-token"
}
```

> Cet endpoint est public.

**Réponse** (200 OK) :
```json
{
  "valid": true,
  "stopId": "stop-uuid",
  "stopName": "Gare Centrale",
  "lineCode": "M1"
}
```

---

## Utilisateurs

### Lister les utilisateurs

```http
GET /api/users
Authorization: Bearer <token>
```

**Paramètres** :
- `page`, `size`, `sortBy`, `sortDir`, `search` : Pagination (tri par défaut : `username`)

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "username": "admin",
    "role": "ADMIN",
    "enabled": true
  }
]
```

### Obtenir un utilisateur

```http
GET /api/users/{id}
Authorization: Bearer <token>
```

### Créer un utilisateur

```http
POST /api/users
Authorization: Bearer <token>
Content-Type: application/json

{
  "username": "operateur1",
  "password": "password123",
  "role": "AGENT"
}
```

**Champs** :
- `username` (requis) : 3 à 50 caractères
- `password` (requis) : 6 à 100 caractères
- `role` (requis) : `ADMIN` ou `AGENT`

**Réponse** (201 Created)

### Modifier un utilisateur

```http
PUT /api/users/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "password": "new-password",
  "role": "ADMIN",
  "enabled": true
}
```

**Champs** :
- `password` (optionnel) : Nouveau mot de passe (6 à 100 caractères)
- `role` (requis) : `ADMIN` ou `AGENT`
- `enabled` (requis) : Activer/désactiver le compte

### Supprimer un utilisateur

```http
DELETE /api/users/{id}
Authorization: Bearer <token>
```

**Réponse** (204 No Content)

---

## Carte du réseau

### Obtenir la carte complète

```http
GET /api/network-map
```

> Cet endpoint est public.

**Réponse** (200 OK) : Données complètes du réseau (lignes, arrêts, coordonnées schématiques) pour le rendu de la carte interactive.

### Obtenir les alertes

```http
GET /api/network-map/alerts
```

> Cet endpoint est public.

**Réponse** (200 OK) : Messages d'alerte actifs affichés sur la carte.

---

## Affichage (Display)

### Obtenir l'état d'affichage par arrêt

```http
GET /api/display/{stopId}
```

> Cet endpoint est public (pas d'authentification requise).

**Réponse** (200 OK) :
```json
{
  "stopId": "stop-uuid",
  "stopName": "Gare Centrale",
  "lines": [
    { "code": "M1", "name": "Métro Ligne 1", "color": "#3B82F6" }
  ],
  "arrivals": [
    {
      "scheduledTime": "14:30",
      "destinationName": "Aéroport",
      "line": {
        "code": "M1",
        "name": "Métro Ligne 1",
        "color": "#3B82F6"
      }
    }
  ],
  "messages": [
    {
      "title": "Information",
      "content": "Pensez à valider votre titre de transport.",
      "severity": "INFO"
    }
  ],
  "version": 42,
  "generatedAt": "2026-02-01T14:25:00Z"
}
```

---

## WebSocket

### Connexion

```javascript
const socket = new SockJS('/ws');
const stompClient = Stomp.over(socket);

stompClient.connect({}, () => {
  // Connexion établie
});
```

### Souscription aux mises à jour

```javascript
stompClient.subscribe('/topic/display/{stopId}', (message) => {
  const displayState = JSON.parse(message.body);
  // Mettre à jour l'affichage
});
```

### Heartbeat appareil

```javascript
stompClient.send('/app/device/heartbeat', {}, JSON.stringify({
  stopId: 'stop-uuid'
}));
```

---

## Codes d'erreur

| Code | Description |
|------|-------------|
| 400 | Bad Request - Données invalides |
| 401 | Unauthorized - Token manquant ou invalide |
| 403 | Forbidden - Permissions insuffisantes |
| 404 | Not Found - Ressource inexistante |
| 409 | Conflict - Conflit (ex: code ligne déjà utilisé) |
| 500 | Internal Server Error - Erreur serveur |

### Format des erreurs

```json
{
  "timestamp": "2026-02-01T12:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Le code de ligne est requis",
  "path": "/api/lines"
}
```
