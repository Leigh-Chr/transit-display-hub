# Transit Display Hub

Plateforme d'information voyageurs en temps réel pour les réseaux de transport public.

## Aperçu

Transit Display Hub permet aux opérateurs de transport de gérer leur réseau (lignes, arrêts, horaires), de diffuser des messages d'alerte, et d'afficher les informations en temps réel sur des écrans aux arrêts.

### Fonctionnalités principales

- **Gestion du réseau** : Configuration des lignes, arrêts et horaires
- **Messages broadcast** : Diffusion d'alertes (Info, Avertissement, Critique) avec ciblage par scope
- **Affichage temps réel** : Écrans kiosques avec mise à jour automatique via WebSocket
- **Gestion des appareils** : Enregistrement et monitoring des écrans d'affichage

## Stack technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Spring Boot 3.3.5, Java 21 |
| Frontend | Angular 18, Tailwind CSS |
| Base de données | H2 (dev), PostgreSQL (prod) |
| Temps réel | WebSocket avec STOMP |
| Authentification | JWT |

## Démarrage rapide

### Prérequis

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

### Accès

- **Interface Admin** : http://localhost:4200
- **API Backend** : http://localhost:8080
- **Affichage Kiosque** : http://localhost:4200/display/{stopId}

### Identifiants par défaut

| Utilisateur | Mot de passe | Rôle |
|-------------|--------------|------|
| admin | admin123 | Administrateur |
| agent | agent123 | Agent |

## Structure du projet

```
transit-display-hub/
├── backend/                 # API Spring Boot
│   ├── src/main/java/
│   │   └── com/transit/hub/
│   │       ├── domain/      # Entités et événements
│   │       ├── application/ # Services métier
│   │       ├── infrastructure/ # Config, sécurité
│   │       └── api/         # Controllers REST
│   └── build.gradle.kts
├── frontend/                # Application Angular
│   ├── src/app/
│   │   ├── core/           # Services, auth, WebSocket
│   │   ├── shared/         # Modèles partagés
│   │   ├── features/       # Composants par feature
│   │   └── layouts/        # Layouts admin/display
│   └── package.json
├── docs/                    # Documentation
└── _bmad-output/           # Artefacts BMad
```

## Documentation

- [Guide d'installation](docs/installation.md) - Configurer l'environnement de développement
- [Documentation API](docs/api.md) - Référence complète de l'API REST
- [Guide développeur](docs/developer-guide.md) - Architecture et bonnes pratiques
- [Guide de déploiement](docs/deployment.md) - Mise en production
- [Guide utilisateur](docs/user-guide.md) - Utilisation de l'interface admin
- [Changelog](CHANGELOG.md) - Historique des versions
- [Contribuer](CONTRIBUTING.md) - Guide de contribution

## Licence

Propriétaire - Tous droits réservés
