# ADR 0016 — Conventions de tags OpenAPI

**Status:** Accepted

## Contexte

ADR 0011 a livré le bundle Springdoc / Swagger UI sous
`/swagger-ui.html`. Sans annotation explicite, Springdoc range tous
les endpoints d'un controller sous un tag dérivé du nom de la classe
(ex. `auth-controller`, `display-controller`). Le résultat est
fonctionnel mais peu lisible — un dev qui découvre l'API doit
deviner que `auth-controller` est l'endpoint de login.

## Décision

Annoter chaque controller publiant des endpoints utiles avec un
`@Tag` portant un nom **en français** et une description courte.
Les tags suivent une **convention de groupes** alignée sur le scope
d'authentification :

| Préfixe | Scope d'auth | Exemples |
|---|---|---|
| « Authentification » | Public POST | `AuthController` |
| « Écrans publics » | Public GET | `DisplayController` |
| « Carte réseau » | Public GET | `NetworkMapController` |
| « Information publique » | Public GET | `AttributionController` |
| « Données GTFS — *X* » | Lecture authentifiée (admin/agent) | `PathwayController`, `ShapeController` |
| « Administration — *X* » | ROLE_ADMIN | `FareController`, `BookingRuleController`, `TranslationController`, `FeedInfoController`, `GtfsAdminController`, `ImportAuditController` |

Le préfixe seul indique la barrière de sécurité, le suffixe
clarifie la fonction. L'admin qui ouvre Swagger UI voit donc d'abord
les groupes d'auth, puis les fonctionnalités au sein de chaque
groupe.

### Annotation `@Operation` minimale

Seuls les endpoints à fort volume d'utilisation reçoivent un
`@Operation` (`AuthController.login`, `GtfsAdminController.reimport`).
Les CRUD admin se contentent du nom de méthode comme `operationId`,
ce qui suffit pour la navigation et la génération client.

### Pas de `@ApiResponse` exhaustif

Springdoc déduit déjà les codes HTTP courants (200, 400, 401, 403,
404) depuis les `ResponseEntity` et le `GlobalExceptionHandler`.
Annoter explicitement chaque endpoint ajouterait du bruit sans
valeur incrémentale.

## Pourquoi ne pas tagger tous les controllers

Les controllers CRUD admin standards (Line, Stop, Itinerary,
Schedule, Device, Message, User, Dashboard) n'ont pas reçu de
`@Tag` dans cette phase parce que :

- Springdoc leur attribue automatiquement un tag dérivé du nom de
  classe, qui suffit à la navigation.
- Un tag personnalisé sur 8 controllers symétriques ajouterait
  ~15 lignes de boilerplate pour un gain visuel marginal.
- Quand un de ces controllers se distingue (un nouveau verbe
  inhabituel, un ré-endpoint), le tag pourra être ajouté
  ponctuellement.

Le seuil est bas : ajouter un tag plus tard est trois lignes.

## Compromis acceptés

- **Tags asymétriques.** Certains controllers sont taggés, d'autres
  non. Acceptable : Swagger UI gère le mélange et le tag par défaut
  (le nom de classe décapitalisé) reste lisible.
- **Pas de localisation des descriptions.** Les descriptions sont
  écrites en français, alignées sur les conventions internes du
  projet (CLAUDE.md). Un dev anglophone navigue par chemin URL et
  par operationId, donc le coût est faible.
