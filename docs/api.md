# Documentation API

## Vue d'ensemble

L'API REST de Transit Display Hub fournit les endpoints pour gérer le réseau de transport, les messages broadcast, les appareils et l'affichage temps réel.

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

---

## Lignes

### Lister toutes les lignes

```http
GET /api/lines
Authorization: Bearer <token>
```

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "code": "L1",
    "name": "Ligne 1 - Centre",
    "color": "#3B82F6",
    "stopCount": 12
  }
]
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
  "code": "L2",
  "name": "Ligne 2 - Express",
  "color": "#10B981"
}
```

**Réponse** (201 Created) :
```json
{
  "id": "generated-uuid",
  "code": "L2",
  "name": "Ligne 2 - Express",
  "color": "#10B981",
  "stopCount": 0
}
```

### Modifier une ligne

```http
PUT /api/lines/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "L2",
  "name": "Ligne 2 - Express Modifiée",
  "color": "#059669"
}
```

### Supprimer une ligne

```http
DELETE /api/lines/{id}
Authorization: Bearer <token>
```

**Réponse** (204 No Content)

> **Attention** : Supprimer une ligne supprime également tous ses arrêts et horaires.

---

## Arrêts

### Lister les arrêts

```http
GET /api/stops
GET /api/stops?lineId={lineId}
Authorization: Bearer <token>
```

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "lineId": "line-uuid",
    "lineCode": "L1",
    "lineColor": "#3B82F6",
    "name": "Gare Centrale",
    "position": 1,
    "scheduleCount": 24
  }
]
```

### Créer un arrêt

```http
POST /api/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "Place du Marché",
  "position": 5
}
```

### Modifier un arrêt

```http
PUT /api/stops/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "Place du Marché - Centre",
  "position": 5
}
```

### Supprimer un arrêt

```http
DELETE /api/stops/{id}
Authorization: Bearer <token>
```

---

## Horaires

### Lister les horaires d'un arrêt

```http
GET /api/stops/{stopId}/schedules
Authorization: Bearer <token>
```

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "stopId": "stop-uuid",
    "departureTime": "08:15",
    "destinationName": "Aéroport",
    "daysOfWeek": ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"]
  }
]
```

### Créer un horaire

```http
POST /api/stops/{stopId}/schedules
Authorization: Bearer <token>
Content-Type: application/json

{
  "departureTime": "09:30",
  "destinationName": "Centre Commercial",
  "daysOfWeek": ["SATURDAY", "SUNDAY"]
}
```

### Modifier un horaire

```http
PUT /api/schedules/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "departureTime": "09:45",
  "destinationName": "Centre Commercial",
  "daysOfWeek": ["SATURDAY", "SUNDAY"]
}
```

### Supprimer un horaire

```http
DELETE /api/schedules/{id}
Authorization: Bearer <token>
```

---

## Messages Broadcast

### Lister les messages

```http
GET /api/messages
GET /api/messages?active=true
Authorization: Bearer <token>
```

**Paramètres** :
- `active` (optionnel) : `true` pour les messages actifs uniquement

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "title": "Travaux en cours",
    "content": "La ligne L1 est perturbée entre 10h et 14h.",
    "severity": "WARNING",
    "scope": "LINE",
    "lineId": "line-uuid",
    "lineName": "Ligne 1",
    "stopId": null,
    "stopName": null,
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z"
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
  "scope": "STOP",
  "lineId": "line-uuid",
  "stopId": "stop-uuid",
  "startTime": "2026-02-01T15:00:00Z",
  "endTime": "2026-02-01T18:00:00Z"
}
```

**Valeurs pour `severity`** :
- `INFO` : Information générale
- `WARNING` : Avertissement
- `CRITICAL` : Alerte critique (affichée en priorité)

**Valeurs pour `scope`** :
- `NETWORK` : Tout le réseau
- `LINE` : Une ligne spécifique (requiert `lineId`)
- `STOP` : Un arrêt spécifique (requiert `lineId` et `stopId`)

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
- `status` (optionnel) : `ONLINE`, `OFFLINE`, `PENDING`

**Réponse** (200 OK) :
```json
[
  {
    "id": "uuid",
    "stopId": "stop-uuid",
    "stopName": "Gare Centrale",
    "lineCode": "L1",
    "lineColor": "#3B82F6",
    "deviceToken": "token-hash",
    "status": "ONLINE",
    "lastHeartbeat": "2026-02-01T12:30:00Z"
  }
]
```

### Enregistrer un appareil

```http
POST /api/devices
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "stop-uuid",
  "lineId": "line-uuid"
}
```

**Réponse** (201 Created) :
```json
{
  "id": "device-uuid",
  "deviceToken": "generated-token-to-save",
  "stopId": "stop-uuid",
  "stopName": "Gare Centrale"
}
```

> **Important** : Le `deviceToken` n'est affiché qu'une seule fois. Il doit être configuré sur l'appareil.

### Supprimer un appareil

```http
DELETE /api/devices/{id}
Authorization: Bearer <token>
```

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
  "line": {
    "code": "L1",
    "name": "Ligne 1",
    "color": "#3B82F6"
  },
  "arrivals": [
    {
      "scheduledTime": "14:30",
      "destinationName": "Aéroport",
      "minutesUntil": 5,
      "line": {
        "code": "L1",
        "name": "Ligne 1",
        "color": "#3B82F6"
      }
    }
  ],
  "messages": [
    {
      "id": "msg-uuid",
      "title": "Information",
      "content": "Pensez à valider votre titre de transport.",
      "severity": "INFO"
    }
  ],
  "version": 42,
  "generatedAt": "2026-02-01T14:25:00Z"
}
```

### Obtenir l'état d'affichage par token

```http
GET /api/display
X-Device-Token: <device-token>
```

> Utilisé par les appareils enregistrés.

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
