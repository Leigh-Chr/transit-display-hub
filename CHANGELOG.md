# Changelog

Toutes les modifications notables de ce projet sont documentées dans ce fichier.

Le format est basé sur [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/),
et ce projet adhère au [Versionnement Sémantique](https://semver.org/lang/fr/).

## [0.1.0] - 2026-02-01

### Ajouté

#### Backend
- Initialisation du projet Spring Boot 3.3.5 avec Java 21
- Entités de domaine : Line, Stop, TimedEntry, BroadcastMessage, Device, User
- Repositories JPA pour toutes les entités
- Services métier : LineService, StopService, ScheduleService, MessageService, DeviceService
- Service DisplayState avec calcul temps réel des arrivées
- Authentification JWT avec JwtService et filtre de sécurité
- Configuration WebSocket STOMP pour les mises à jour temps réel
- Événements domaine pour déclencher le recalcul des états d'affichage
- Controllers REST : Auth, Lines, Stops, Schedules, Messages, Devices, Display
- GlobalExceptionHandler pour la gestion unifiée des erreurs
- DataLoader créant les utilisateurs admin et agent par défaut
- Support H2 (développement) et PostgreSQL (production)

#### Frontend
- Initialisation du projet Angular 18 avec composants standalone
- Configuration Tailwind CSS pour le styling
- Service d'authentification avec gestion JWT
- Guard et interceptor pour la protection des routes
- Services API pour toutes les ressources (Lines, Stops, Schedules, Messages, Devices, Display)
- Service WebSocket avec reconnexion automatique
- Layout admin avec navigation latérale
- Dashboard avec statistiques et alertes
- Écran de gestion des lignes (CRUD)
- Écran de gestion des arrêts avec filtrage par ligne
- Écran de gestion des horaires avec sélection des jours
- Écran de gestion des messages broadcast avec scope
- Écran de gestion des appareils avec affichage du token
- Composant Kiosk pour l'affichage public temps réel
- Support des Signals Angular pour la réactivité

#### Documentation
- README principal du projet
- Guide d'installation
- Documentation API REST
- Guide développeur
- Guide de déploiement
- Guide utilisateur

#### BMad Artifacts
- PRD (Product Requirements Document)
- UX Design Specification
- Architecture Document
- 10 Epics avec 37 Stories
- Implementation Readiness Report
- Sprint Status tracking

### Technique
- Gradle 9.3.1 pour le build backend
- Angular CLI pour le build frontend
- TypeScript strict mode
- Validation Bean Validation (backend)
- Signals et computed pour la réactivité (frontend)

---

## Types de changements

- `Ajouté` : nouvelles fonctionnalités
- `Modifié` : changements dans les fonctionnalités existantes
- `Déprécié` : fonctionnalités bientôt supprimées
- `Supprimé` : fonctionnalités supprimées
- `Corrigé` : corrections de bugs
- `Sécurité` : corrections de vulnérabilités
