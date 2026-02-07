# Documentation API

## Vue d'ensemble

L'API REST de Transit Display Hub fournit les endpoints
pour gerer le reseau de transport, les itineraires, les
horaires, les messages broadcast, les appareils, les
utilisateurs et l'affichage temps reel.

**URL de base** : `http://localhost:8080/api`

## Authentification

### JWT Token

L'API utilise l'authentification JWT (JSON Web Token).
Le token doit etre inclus dans le header `Authorization`
pour toutes les requetes protegees.

```text
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

**Reponse** (200 OK) :

```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2026-02-02T13:00:00Z",
  "role": "ADMIN",
  "username": "admin"
}
```

### Permissions par endpoint

| Endpoint                                   | Acces        |
| ------------------------------------------ | ------------ |
| `/api/auth/**`                             | Public       |
| `/api/display/**`                          | Public       |
| `/api/network-map/**`                      | Public       |
| `/api/devices/authenticate`                | Public       |
| `GET /api/itineraries/**`                  | Public       |
| `GET /api/stops/*/schedules`               | Public       |
| `/api/messages/**`                         | Admin, Agent |
| `GET /api/lines/**`, `GET /api/stops/**`   | Admin, Agent |
| `/api/lines/**` (POST, PUT, DELETE)        | Admin        |
| `/api/stops/**` (POST, PUT, DELETE)        | Admin        |
| `/api/schedules/**` (POST, PUT, DELETE)    | Admin        |
| `/api/itineraries/**` (POST, PUT, DELETE)  | Admin        |
| `/api/devices/**`, `/api/users/**`         | Admin        |

---

## Lignes

### Lister les lignes

```http
GET /api/lines
Authorization: Bearer <token>
```

**Parametres de pagination** (optionnels) :

- `page` : Numero de page (0-indexed, active la
  pagination)
- `size` : Taille de page (defaut : 10)
- `sortBy` : Champ de tri (defaut : `code`)
- `sortDir` : Direction du tri (`asc` ou `desc`,
  defaut : `asc`)
- `search` : Recherche textuelle

**Reponse sans pagination** (200 OK) :

```json
[
  {
    "id": "uuid",
    "code": "M1",
    "name": "Metro Ligne 1",
    "color": "#3B82F6",
    "type": "METRO",
    "stopCount": 12,
    "itineraryCount": 2
  }
]
```

**Reponse avec pagination** (200 OK) :

```json
{
  "content": [],
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

### Creer une ligne

```http
POST /api/lines
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "M2",
  "name": "Metro Ligne 2",
  "color": "#10B981",
  "type": "METRO"
}
```

**Champs** :

- `code` (requis) : Identifiant court, max 10
  caracteres, unique
- `name` (requis) : Nom complet, max 100 caracteres
- `color` (requis) : Couleur hexadecimale
  (ex: `#FF5733`)
- `type` (requis) : Type de ligne
  (`METRO`, `BUS`, `TRAM`, `TRAIN`)

**Reponse** (201 Created)

### Modifier une ligne

```http
PUT /api/lines/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "code": "M2",
  "name": "Metro Ligne 2 - Express",
  "color": "#059669",
  "type": "METRO"
}
```

### Supprimer une ligne

```http
DELETE /api/lines/{id}
Authorization: Bearer <token>
```

**Reponse** (204 No Content)

> **Attention** : Supprimer une ligne supprime egalement
> ses itineraires et horaires associes.

---

## Arrets

### Lister les arrets

```http
GET /api/stops
GET /api/stops?lineId={lineId}
Authorization: Bearer <token>
```

**Parametres** :

- `lineId` (optionnel) : Filtrer par ligne
- `page`, `size`, `sortBy`, `sortDir`, `search` :
  Pagination (meme format que les lignes, tri par
  defaut : `name`)

**Reponse** (200 OK) :

```json
[
  {
    "id": "uuid",
    "name": "Gare Centrale",
    "latitude": 48.8566,
    "longitude": 2.3522,
    "lines": [
      {
        "id": "uuid",
        "code": "M1",
        "name": "Metro Ligne 1",
        "color": "#3B82F6"
      }
    ],
    "scheduleCount": 24,
    "hasDevice": true
  }
]
```

### Creer un arret

```http
POST /api/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Place du Marche",
  "lineIds": ["line-uuid-1", "line-uuid-2"],
  "latitude": 48.8580,
  "longitude": 2.3540
}
```

**Champs** :

- `name` (requis) : Nom de l'arret, max 100 caracteres
- `lineIds` (requis) : Ensemble d'IDs de lignes
  (au moins une)
- `latitude` (optionnel) : Coordonnee GPS
- `longitude` (optionnel) : Coordonnee GPS

### Modifier un arret

```http
PUT /api/stops/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Place du Marche - Centre",
  "lineIds": ["line-uuid-1"],
  "latitude": 48.8580,
  "longitude": 2.3540
}
```

### Supprimer un arret

```http
DELETE /api/stops/{id}
Authorization: Bearer <token>
```

---

## Itineraires

Un itineraire represente un parcours ordonne d'arrets
sur une ligne (ex: direction "Aeroport").

### Lister les itineraires

```http
GET /api/itineraries
GET /api/itineraries?lineId={lineId}
```

> Les requetes GET sont publiques (pas d'authentification
> requise).

**Parametres** :

- `lineId` (optionnel) : Filtrer par ligne
- `page`, `size`, `sortBy`, `sortDir`, `search` :
  Pagination (tri par defaut : `name`)

**Reponse** (200 OK) :

```json
[
  {
    "id": "uuid",
    "name": "Direction Aeroport",
    "terminusName": "Aeroport",
    "line": {
      "id": "uuid",
      "code": "M1",
      "name": "Metro Ligne 1",
      "color": "#3B82F6"
    },
    "stops": [
      {
        "id": "stop-uuid",
        "name": "Gare Centrale",
        "position": 0
      },
      {
        "id": "stop-uuid",
        "name": "Place du Marche",
        "position": 1
      },
      {
        "id": "stop-uuid",
        "name": "Aeroport",
        "position": 2
      }
    ]
  }
]
```

### Obtenir un itineraire

```http
GET /api/itineraries/{id}
```

### Creer un itineraire

```http
POST /api/itineraries
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "Direction Aeroport",
  "stopIds": ["stop-uuid-1", "stop-uuid-2", "stop-uuid-3"]
}
```

**Champs** :

- `lineId` (requis) : ID de la ligne
- `name` (requis) : Nom de l'itineraire, max 100
  caracteres
- `stopIds` (optionnel) : Liste ordonnee d'IDs d'arrets

**Reponse** (201 Created)

### Modifier un itineraire

```http
PUT /api/itineraries/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "lineId": "line-uuid",
  "name": "Direction Aeroport - Express"
}
```

### Supprimer un itineraire

```http
DELETE /api/itineraries/{id}
Authorization: Bearer <token>
```

### Gerer les arrets d'un itineraire

#### Remplacer tous les arrets

```http
PUT /api/itineraries/{id}/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopIds": ["stop-uuid-1", "stop-uuid-2", "stop-uuid-3"]
}
```

#### Ajouter un arret a un itineraire

```http
POST /api/itineraries/{id}/stops
Authorization: Bearer <token>
Content-Type: application/json

{
  "stopId": "stop-uuid",
  "position": 2
}
```

#### Retirer un arret d'un itineraire

```http
DELETE /api/itineraries/{id}/stops/{stopId}
Authorization: Bearer <token>
```

---

## Horaires

Les horaires sont bases sur le modele itineraire :
chaque horaire associe une heure de depart a un arret
et un itineraire.

### Lister les horaires d'un arret

```http
GET /api/stops/{stopId}/schedules
```

> Cet endpoint est public.

**Reponse** (200 OK) :

```json
[
  {
    "id": "uuid",
    "time": "08:15",
    "stopId": "stop-uuid",
    "itinerary": {
      "id": "itinerary-uuid",
      "name": "Direction Aeroport",
      "terminusName": "Aeroport",
      "line": {
        "id": "line-uuid",
        "code": "M1",
        "name": "Metro Ligne 1",
        "color": "#3B82F6"
      }
    }
  }
]
```

### Creer un horaire

```http
POST /api/stops/{stopId}/schedules
Authorization: Bearer <token>
Content-Type: application/json

{
  "time": "09:30",
  "itineraryId": "itinerary-uuid"
}
```

**Champs** :

- `time` (requis) : Heure de depart au format `HH:mm`
- `itineraryId` (requis) : ID de l'itineraire
  (determine la ligne et la direction)

### Modifier un horaire

```http
PUT /api/schedules/{id}
Authorization: Bearer <token>
Content-Type: application/json

{
  "time": "09:45",
  "itineraryId": "itinerary-uuid"
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
GET /api/messages?severity=CRITICAL
Authorization: Bearer <token>
```

**Parametres** :

- `active` (optionnel) : `true` pour les messages
  actifs uniquement
- `severity` (optionnel) : Filtrer par severite
  (`INFO`, `WARNING`, `CRITICAL`)
- `page`, `size`, `sortBy`, `sortDir`, `search` :
  Pagination (tri par defaut : `startTime` desc)

**Reponse** (200 OK) :

```json
[
  {
    "id": "uuid",
    "title": "Travaux en cours",
    "content": "La ligne M1 est perturbee.",
    "severity": "WARNING",
    "startTime": "2026-02-01T10:00:00Z",
    "endTime": "2026-02-01T14:00:00Z",
    "scopeType": "LINE",
    "scopeId": "line-uuid",
    "scopeInfo": {
      "name": "Metro Ligne 1"
    },
    "active": true
  }
]
```

### Creer un message

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

- `title` (requis) : Titre, max 100 caracteres
- `content` (requis) : Contenu, max 500 caracteres
- `severity` (requis) : `INFO`, `WARNING` ou `CRITICAL`
- `startTime` (requis) : Date/heure de debut (ISO 8601)
- `endTime` (requis) : Date/heure de fin (ISO 8601)
- `scopeType` (requis) : `NETWORK`, `LINE` ou `STOP`
- `scopeId` (optionnel) : ID de la ligne ou de l'arret
  (requis si scope LINE ou STOP)

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

**Parametres** :

- `status` (optionnel) : `ONLINE` ou `OFFLINE`

**Reponse** (200 OK) :

```json
[
  {
    "id": "uuid",
    "stopId": "stop-uuid",
    "stopName": "Gare Centrale",
    "lines": [
      {
        "id": "line-uuid",
        "code": "M1",
        "name": "Metro Ligne 1",
        "color": "#3B82F6"
      }
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

**Reponse** (201 Created) :

```json
{
  "id": "device-uuid",
  "token": "generated-token-to-save",
  "stopId": "stop-uuid",
  "stopName": "Gare Centrale"
}
```

> **Important** : Le `token` n'est affiche qu'une seule
> fois. Il doit etre configure sur l'appareil.

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
POST /api/devices/authenticate
Content-Type: application/json

{
  "token": "device-token"
}
```

> Cet endpoint est public.

**Reponse** (200 OK) :

```json
{
  "valid": true,
  "stopId": "stop-uuid",
  "stopName": "Gare Centrale",
  "lines": [
    {
      "id": "line-uuid",
      "code": "M1",
      "name": "Metro Ligne 1",
      "color": "#3B82F6"
    }
  ]
}
```

---

## Utilisateurs

### Lister les utilisateurs

```http
GET /api/users
Authorization: Bearer <token>
```

**Parametres** :

- `page`, `size`, `sortBy`, `sortDir`, `search` :
  Pagination (tri par defaut : `username`)

**Reponse** (200 OK) :

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

### Creer un utilisateur

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

- `username` (requis) : 3 a 50 caracteres
- `password` (requis) : 6 a 100 caracteres
- `role` (requis) : `ADMIN` ou `AGENT`

**Reponse** (201 Created)

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

- `password` (optionnel) : Nouveau mot de passe
  (6 a 100 caracteres)
- `role` (requis) : `ADMIN` ou `AGENT`
- `enabled` (requis) : Activer/desactiver le compte

### Supprimer un utilisateur

```http
DELETE /api/users/{id}
Authorization: Bearer <token>
```

**Reponse** (204 No Content)

---

## Carte du reseau

### Obtenir la carte complete

```http
GET /api/network-map
```

> Cet endpoint est public.

**Reponse** (200 OK) : Donnees completes du reseau
(lignes, arrets, coordonnees schematiques) pour le
rendu de la carte interactive.

### Obtenir les alertes

```http
GET /api/network-map/alerts
```

> Cet endpoint est public.

**Reponse** (200 OK) : Messages d'alerte actifs affiches
sur la carte.

---

## Affichage (Display)

### Obtenir l'etat d'affichage par arret

```http
GET /api/display/{stopId}
```

> Cet endpoint est public (pas d'authentification
> requise).

### Obtenir l'etat d'affichage par token appareil

```http
GET /api/display
X-Device-Token: <device-token>
```

> Utilise le token de l'appareil pour determiner l'arret
> associe. Retourne 401 si le token est invalide.

**Reponse** (200 OK) :

```json
{
  "stopId": "stop-uuid",
  "stopName": "Gare Centrale",
  "lines": [
    {
      "id": "line-uuid",
      "code": "M1",
      "name": "Metro Ligne 1",
      "color": "#3B82F6"
    }
  ],
  "arrivals": [
    {
      "scheduledTime": "14:30",
      "destinationName": "Aeroport",
      "line": {
        "id": "line-uuid",
        "code": "M1",
        "name": "Metro Ligne 1",
        "color": "#3B82F6"
      }
    }
  ],
  "messages": [
    {
      "title": "Information",
      "content": "Pensez a valider votre titre.",
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
  // Connexion etablie
});
```

### Souscription aux mises a jour

```javascript
stompClient.subscribe(
  '/topic/display/{stopId}',
  (message) => {
    const displayState =
      JSON.parse(message.body);
    // Mettre a jour l'affichage
  }
);
```

### Heartbeat appareil

```javascript
stompClient.send(
  '/app/device/heartbeat',
  {},
  JSON.stringify({ stopId: 'stop-uuid' })
);
```

---

## Codes d'erreur

| Code | Description                                    |
| ---- | ---------------------------------------------- |
| 400  | Bad Request - Donnees invalides                |
| 401  | Unauthorized - Token manquant ou invalide      |
| 403  | Forbidden - Permissions insuffisantes          |
| 404  | Not Found - Ressource inexistante              |
| 409  | Conflict - Ex: code ligne deja utilise         |
| 500  | Internal Server Error - Erreur serveur         |

### Format des erreurs

Toutes les erreurs (y compris 401 et 403) retournent
une reponse JSON structuree :

```json
{
  "timestamp": "2026-02-01T12:00:00Z",
  "status": 400,
  "error": "Bad Request",
  "message": "Le code de ligne est requis",
  "errors": [
    {
      "field": "code",
      "message": "ne doit pas etre vide"
    }
  ],
  "path": "/api/lines"
}
```

Le champ `errors` est present uniquement pour les
erreurs de validation (400).

### Messages d'erreur 409

Selon le type de violation :

- **Contrainte d'unicite** : Data conflict: a record
  with this value already exists
- **Cle etrangere** : Cannot complete operation: this
  record is referenced by other data
- **Champ requis manquant** : A required field is
  missing
