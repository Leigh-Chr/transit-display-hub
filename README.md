# Transit Display Hub

Plateforme d'information voyageurs en temps reel pour
les reseaux de transport public.

## Apercu

Transit Display Hub permet aux operateurs de transport
de gerer leur reseau (lignes, arrets, itineraires,
horaires), de diffuser des messages d'alerte, et
d'afficher les informations en temps reel sur des ecrans
aux arrets.

### Fonctionnalites principales

- **Gestion du reseau** : Configuration des lignes
  (metro, bus, tram, train), arrets, itineraires et
  horaires
- **Messages broadcast** : Diffusion d'alertes (Info,
  Avertissement, Critique) avec ciblage par scope
  (reseau, ligne, arret)
- **Affichage temps reel** : Ecrans kiosques avec mise
  a jour automatique via WebSocket
- **Carte du reseau** : Visualisation interactive du
  reseau avec recherche d'itineraires
- **Gestion des appareils** : Enregistrement et
  monitoring des ecrans d'affichage
- **Gestion des utilisateurs** : Administration des
  comptes (Admin, Agent)

## Stack technique

| Composant        | Technologie                                |
| ---------------- | ------------------------------------------ |
| Backend          | Spring Boot 4.0.2, Java 21                 |
| Frontend         | Angular 21, Tailwind CSS, Angular Material |
| Base de donnees  | H2 (dev), PostgreSQL (prod)                |
| Temps reel       | WebSocket avec STOMP                       |
| Authentification | JWT                                        |
| Tests            | JUnit 5, Vitest, Playwright                |

## Demarrage rapide

### Prerequis

- Java 21 (JDK)
- Node.js 20+
- npm 10+

### Installation

```bash
# Cloner le repository
git clone <repository-url>
cd transit-display-hub

# Backend
cd backend
./gradlew bootRun

# Frontend (nouveau terminal)
cd frontend
npm install
npm start
```

### Acces

- **Interface Admin** : <http://localhost:4200>
- **API Backend** : <http://localhost:8080>
- **Carte du reseau** : <http://localhost:4200/map>
- **Affichage Kiosque** :
  `http://localhost:4200/display/{stopId}`

### Identifiants par defaut

| Utilisateur | Mot de passe | Role           |
| ----------- | ------------ | -------------- |
| admin       | admin123     | Administrateur |
| agent       | agent123     | Agent          |

## Structure du projet

```text
transit-display-hub/
+-- backend/                 # API Spring Boot
|   +-- src/main/java/
|   |   +-- com/transit/hub/
|   |       +-- domain/      # Entites, enums, events
|   |       +-- application/ # Services, DTOs, exceptions
|   |       +-- infrastructure/ # Securite, WebSocket
|   |       +-- api/         # Controllers REST
|   +-- build.gradle.kts
+-- frontend/                # Application Angular
|   +-- src/app/
|   |   +-- core/           # Services, auth, WebSocket
|   |   +-- shared/         # Modeles, composants
|   |   +-- features/       # Admin, affichage, carte
|   |   +-- layouts/        # Layouts admin/display
|   +-- package.json
+-- docs/                    # Documentation
```

## Documentation

- [Guide d'installation](docs/installation.md) -
  Configurer l'environnement de developpement
- [Documentation API](docs/api.md) -
  Reference complete de l'API REST
- [Guide developpeur](docs/developer-guide.md) -
  Architecture et bonnes pratiques
- [Guide de deploiement](docs/deployment.md) -
  Mise en production
- [Guide utilisateur](docs/user-guide.md) -
  Utilisation de l'interface admin
- [Changelog](CHANGELOG.md) - Historique des versions
- [Contribuer](CONTRIBUTING.md) - Guide de contribution

## Licence

Proprietaire - Tous droits reserves
