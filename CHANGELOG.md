# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [1.5.1] — 2026-05-12

Patch defensif autour du dernier P2 de l'audit du 12/05 (pagination
findAll). Aucun changement de signature publique — les méthodes
existantes restent `List<T>`.

### Fixed

- **`UnpaginatedCap.findAllCapped`** — nouveau helper partagé qui
  borne tout `repository.findAll()` non paginé à 1 000 lignes et
  loggue un `WARN` (label appelant + totalElements) quand le cap est
  atteint. Appliqué à `AttributionService.getAllAttributions`,
  `BookingRuleService.browse`, `UserService.getAll` (l'overload
  legacy sans `Pageable`), `MessageService.getAllMessages` (la table
  `broadcast_messages` était la seule à grossir sans borne amont) et
  à trois des huit reads de `FaresV2Service.browse` — les cinq
  autres conservent leurs variantes `findAllWith*` JOIN-FETCH parce
  que le cap dégraderait l'optimisation. 3 nouveaux specs unitaires
  sur le helper (forme du `Pageable`, pass-through sous cap, warn à
  cap atteint).

## [1.5.0] — 2026-05-12

Suite de l'audit du 2026-05-12 : ferme les deux P0 reportés depuis
1.4.2 (tests d'Importer GTFS + tests des controllers à 0 %), achève
les régressions i18n sur les dialogs admin, et livre une vague de
hardening sécu (TOCTOU refresh, révocation immédiate des comptes
désactivés, scheduler de purge, restriction de prometheus, trust
explicite des proxies) ainsi qu'une couche d'observabilité
(correlation id MDC + logback async). Audit consolidé à 11/11 P0
fermés.

### Added

- **Correlation id sur les logs** : `RequestIdFilter` honore l'en-tête
  `X-Request-Id` quand un reverse-proxy en pousse un, sinon génère un
  UUID. Publié sur MDC sous la clé `requestId`, ré-émis sur la
  réponse, libéré dans le `finally` même si la chaîne en aval lève.
  `logback-spring.xml` ajoute un appender async (queue 256,
  `neverBlock=true`) et intègre `{requestId}` dans le pattern.
- **`@Scheduled` quotidien sur `RefreshTokenService#purgeExpired`**
  (cron `app.auth.refresh-token-purge-cron`, défaut 04:30) — la
  méthode existait depuis v1.4.0 mais n'était jamais appelée.
- **Liste de proxies HTTP de confiance** : `app.security.trusted-proxies`
  (CSV des IPs des reverse-proxies). `X-Forwarded-For` n'est plus
  honoré que si le peer TCP fait partie de la liste — défaut vide
  pour fail-safe.
- **Workflow CodeQL** (Java/Kotlin + JS/TS, pack `security-and-quality`,
  hebdomadaire + push/PR).
- **E2E i18n guard** : `frontend/e2e/i18n-public-pages.spec.ts` visite
  /login, /map, /map/list, /not-found en FR et EN, exige au moins une
  ancre traduite par locale et bloque toute fuite de chaîne de l'autre
  langue. Vérifie aussi que `<html lang>` suit la locale résolue au
  boot.
- **59 tests unitaires GTFS Importer** : `ItineraryImporterTest` (25)
  + `RouteImporterTest` (8) + extension `GtfsParseTest` (+26).
  Couvrent les statics pures que l'audit signalait comme « taillées
  pour le test » : `majorityWheelchair/Bikes/Cars`,
  `computeXOverride`, `buildItineraryName`, `routeTypeLabel`,
  `resolveAgency`, plus les helpers `GtfsParse` partagés.
- **19 tests d'intégration controllers** :
  `FareCalculatorControllerIntegrationTest` (7),
  `FlexStopTimeControllerIntegrationTest` (6),
  `DeviceHeartbeatControllerIntegrationTest` (6) — les trois
  controllers que l'audit avait flagués à 0 % JaCoCo passent à ~100 %.

### Security

- **S-02 final — TOCTOU sur la rotation du refresh token.** Deux
  /refresh concurrents passaient les checks de fraîcheur et
  émettaient chacun un successeur avant de committer `replacedBy`,
  contournant silencieusement la détection de réutilisation.
  `findByTokenHashForUpdate` ajoute un lock pessimiste (`SELECT FOR
  UPDATE`) ; le second appelant voit l'état rotaté et tombe sur le
  chemin chain-revocation.
- **S-06 — `User.enabled=false` était ignoré pendant 8 h.** Un user
  désactivé restait actif jusqu'à l'expiration de son JWT. Le filtre
  `JwtAuthenticationFilter` re-lit l'utilisateur en clé primaire à
  chaque requête authentifiée — absent ou `!enabled` →
  `SecurityContext` anonyme + `WWW-Authenticate:
  error_description="Account disabled"` pour distinguer un lockout
  d'un simple timeout.
- **`/actuator/prometheus` passe sous ADMIN.** L'endpoint scrape
  cessait d'être `permitAll` (n'importe qui pouvait inventorier le
  catalogue HTTP). Un Prometheus local doit désormais scraper avec
  un JWT admin ou être posté derrière un reverse-proxy filtrant.

### Fixed

- **5 dialogs admin entièrement traduits** : `schedule-dialog`,
  `device-dialog`, `itinerary-dialog`, `itinerary-stops-dialog`,
  `user-dialog`. Les clés étaient déjà prêtes sous
  `admin.{ns}.dialog.*` ; le wiring `*transloco` les consomme
  maintenant. 93 spec cases mis à jour avec `TranslocoTestingModule`.

### Changed

- **`AUTH_COOKIE_SECURE` défaut `true`** — déplacé hors de 1.4.2 mais
  documenté ici car la doc d'installation rappelle qu'un opérateur
  qui passe en HTTP doit désormais opt-out explicitement.

## [1.4.2] — 2026-05-12

Patch suivi de l'audit consolidé du 2026-05-12. Ferme 9 des 11 P0
identifiés (sécurité auth, régressions i18n, fuites WebSocket,
side-effects rxResource, asymétrie d'import GTFS) sans changement
d'API ni de comportement utilisateur normal — toutes les corrections
sont rétrocompatibles. Les deux P0 restants (tests unitaires des
GTFS Importers, tests des controllers Fare/Flex/DeviceHeartbeat à
0 %) sont reportés en 1.5.0.

### Security

- **`JWT_SECRET` requis dans le profil dev aussi** : le littéral
  `dev-secret-key-for-jwt-token-generation-…` ne traîne plus dans
  `application.yml`. Toute installation (dev, prod, kiosk) doit
  fournir `JWT_SECRET` ; `@NotBlank` sur `JwtProperties` fait
  échouer le boot autrement.
- **CSRF bypass Bearer fermé** : le filtre `csrfProtectionMatcher`
  exemptait n'importe quel appelant dont l'en-tête `Authorization`
  commençait par `Bearer ` sans valider l'en-tête. Combiné au
  fallback cookie introduit en 1.4.0, un formulaire cross-site
  pouvait s'authentifier via le cookie de la victime en ajoutant un
  faux Bearer. Le matcher refuse maintenant l'exemption dès qu'un
  cookie d'auth accompagne le Bearer. Extrait dans
  `CsrfProtectionMatcher` + 13 cas de test unitaires.
- **`/api/auth/refresh` et `/api/auth/logout` reviennent sous CSRF**
  (seule `/login` reste exempte parce qu'aucun XSRF cookie n'a pu
  être posé avant). Sans ce verrou, un opérateur passant
  `SameSite=Strict → Lax` ouvrait une porte au logout en un clic
  cross-site.
- **`cookie-secure` défaut `true`** au niveau racine — le profil
  dev passe explicitement à `false` pour `ng serve` sur
  `http://localhost`. Un prod mal configuré qui oublie
  `AUTH_COOKIE_SECURE=true` voit maintenant la session échouer au
  lieu d'expédier la JWT en clair.
- **Credentials d'amorce plus loggués** : `GtfsDataLoader` cessait
  d'afficher `admin / admin123` en INFO à chaque démarrage,
  publication implicite à tout collecteur de logs.

### Fixed

- **`BaseStompService` ne fuit plus son abonnement `logout$`** :
  les trois sous-classes (`WebSocketService`, `HubWebSocketService`,
  `NetworkMapWebSocketService`) déclaraient chacune leur propre
  `authService.logout$.subscribe` dans le constructeur sans
  `unsubscribe`. La logique est hissée dans la base, attachée à
  `takeUntilDestroyed()`, et `ngOnDestroy` libère le client STOMP.
  La Promise renvoyée par `client.deactivate()` n'est plus jetée à
  la poubelle.
- **`rxResource.params` redevient pur sur les pages admin
  Lines + Stops** : les mutations de `tableState` et `lineId`
  glissent dans des `effect()` séparés. La snap-back de page après
  un delete sort du `computed` (anti-pattern) et passe également en
  `effect()`.
- **Les erreurs de chargement remontent dans l'UI** au lieu de
  finir en `catchError → EMPTY` (qui s'affichait comme un
  empty-state silencieux). Nouveau bloc d'état d'erreur avec
  bouton « Réessayer » sur les listes Lines et Stops.
- **Login + dashboard widget i18n** : `auth/login` était la seule
  page publique non authentifiée et tout son contenu (titre,
  labels, bouton, erreurs, hint dev) restait codé en anglais.
  `data-overview-card` dans le dashboard admin restait en français
  hardcodé. Les deux passent par Transloco ; les clés vivent dans
  `en.json` / `fr.json`.
- **`<html lang>` synchronisé au boot** : `LocaleService` ne
  l'écrivait que dans `setLang()`. Un utilisateur dont la première
  visite résolvait à `fr` restait coincé sur le `lang="en"` static
  de `index.html` jusqu'au premier toggle de langue.

### Changed

- **`ItineraryImporter` unifié** : les chemins create et update
  populaient les 13 mêmes champs via deux blocs (builder vs
  setters) dont l'asymétrie aurait fait disparaître silencieusement
  tout champ ajouté sur une seule branche. Un seul bloc de
  setters reste désormais.
- **Contraste de la sidenav** : `--mdc-list-item-supporting-text-color`
  passe de `rgba(255,255,255,0.5)` (≈ 3 : 1 sur `#1A1A2E`, fail
  WCAG AA) à `0.65` (≥ 4.5 : 1).
- **Verrou JaCoCo sur les branches** : `jacocoTestCoverageVerification`
  ne gatait que la couverture d'instructions. Un nouveau seuil
  BRANCH ≥ 45 % verrouille la base actuelle (~48 %).

### Build

- **`backend/Dockerfile`** ne hardcode plus
  `transit-display-hub-1.3.0.jar` — globbing sur
  `transit-display-hub-*.jar` pour que la prochaine bump de version
  ne casse pas le build. `HEALTHCHECK` ajouté sur les deux
  Dockerfiles (backend = `actuator/health`, frontend = `/`).
- **`frontend/package-lock.json`** réaligné sur la version
  `1.4.1` (était resté à `1.3.0`).
- **`ops/kiosk/install.sh`** : la note « pre-built GHCR images are
  not yet published » disparaît — `release.yml` publie depuis
  v1.4.0.
- **Workflow CodeQL** ajouté (Java/Kotlin + JS/TS, pack
  `security-and-quality`, scan hebdomadaire + push/PR).
- **`e2e.yml` exécute aussi firefox** en plus de chromium (le
  local couvrait déjà la matrice tri-browser depuis 1.4.1).
  `JWT_SECRET` per-run injecté pour que le profil dev démarre.

## [1.4.1] — 2026-05-12

Patch interne sans changement fonctionnel. Consolide les properties Spring
liées à l'authentification et met à jour l'attribution du Code of Conduct
pour refléter la version 2.1 du Contributor Covenant.

### Changed

- **`JwtProperties` et `AuthProperties` typés** : les `@Value("${app.jwt.*}")`
  et `@Value("${app.auth.*}")` dispersés dans `JwtService`,
  `RefreshTokenService`, `JwtAuthenticationFilter` et `AuthCookieFactory`
  sont remplacés par deux records `@ConfigurationProperties`. La
  validation `@NotBlank` sur `app.jwt.secret` fait échouer le boot
  immédiatement si le secret est manquant.
- **`CODE_OF_CONDUCT.md`** : attribution mise à jour vers Contributor
  Covenant v2.1 (lien officiel + FAQ + traductions).

## [1.4.0] — 2026-05-11

Refonte du flow d'authentification : passage à une session basée sur des
cookies httpOnly avec rotation de refresh tokens et protection CSRF.
Sprint 4 chantier E livré (le dernier de l'audit du 2026-05-10). Aucune
migration manuelle pour les utilisateurs : le prochain login pose les
cookies automatiquement. Une nouvelle migration Flyway (`V50__refresh_tokens.sql`)
crée la table de stockage des refresh tokens (digests SHA-256).

### Added

- **Refresh tokens persistés avec rotation** : `RefreshTokenService` mint un
  jeton aléatoire de 256 bits, stocke uniquement le digest SHA-256, et
  invalide la chaîne entière si un jeton déjà tourné est rejoué. TTL
  configurable via `JWT_REFRESH_EXPIRATION_DAYS` (défaut 14 jours).
- **Endpoints `/api/auth/refresh`, `/api/auth/logout`, `/api/auth/me`** :
  le contrôleur d'auth pose deux cookies httpOnly (`ACCESS_TOKEN` sur `/`
  et `REFRESH_TOKEN` sur `/api/auth`) en plus du body legacy ; `/me`
  permet au front de reconstruire son état après un rechargement.
- **Filtre JWT — fallback cookie** : `JwtAuthenticationFilter` lit le
  cookie `ACCESS_TOKEN` quand aucun header Bearer n'est présent, ce qui
  ouvre la voie au mode 100 % cookie côté navigateur tout en conservant
  Swagger UI.
- **Protection CSRF** : Spring Security émet désormais un cookie
  `XSRF-TOKEN` lisible par le JavaScript, et exige `X-XSRF-TOKEN` sur
  chaque mutation. Les appels Bearer historiques sont exemptés via un
  `RequestMatcher` dédié.
- **Frontend — provider XSRF + initialisation au boot** : Angular mappe
  désormais `XSRF-TOKEN` ↔ `X-XSRF-TOKEN` automatiquement
  (`withXsrfConfiguration`), et un `provideAppInitializer` appelle
  `/api/auth/me` avant la première route pour reconstruire la session
  depuis le cookie.

### Changed

- **AuthService Angular** : le JWT n'est plus persisté dans localStorage.
  L'état utilisateur (`username`, `role`) vient de `/api/auth/me` et le
  token en mémoire est rafraîchi en arrière-plan pour les WebSockets,
  qui continuent à authentifier via un header STOMP Bearer.
- **Auth interceptor Angular** : ajoute `withCredentials: true` à chaque
  requête, et sur un 401 hors `/api/auth/*` tente automatiquement
  `/api/auth/refresh` avant de retenter la requête originale.
- **Tests d'intégration** : 19 tests mutants no-auth récoltent
  `.with(csrf())` pour traverser le filtre CSRF et atteindre
  réellement le filtre d'auth.

### Removed

- Dépendance frontend `jwt-decode` (le client ne décode plus le JWT
  lui-même — l'identité vient de l'endpoint dédié `/api/auth/me`).

### Security

- Le JWT n'est plus exposé au JavaScript par défaut, ce qui ferme la
  porte aux exfiltrations via XSS.
- Rotation systématique du refresh token : tout rejeu d'un jeton déjà
  tourné est interprété comme un vol et révoque l'ensemble des refresh
  tokens actifs de l'utilisateur.
- Origin/audience claims + minimum 32 octets de clé JWT déjà appliqués
  en v1.2.0 restent en place ; ces protections s'ajoutent à la nouvelle
  posture cookie + CSRF.

## [1.3.0] — 2026-05-11

Sprint 4 : refactoring structurel backend (décomposition GtfsImportService),
migration rxResource frontend, expansion E2E Playwright, et améliorations
d'accessibilité. Aucun changement cassant, aucune modification de schéma de
base de données. Le chantier E (refactoring auth httpOnly + refresh tokens)
est reporté à v1.4.0.

### Added

- **Axe-core a11y smoke sur les pages publiques** : test E2E automatisé
  vérifiant l'absence de violations d'accessibilité critiques sur les pages
  kiosk et hub via `@axe-core/playwright`.
- **E2E — Page Object Model + fixture d'authentification** : refactorisation
  de la suite Playwright en objets de page réutilisables ; fixture `auth`
  partagée évitant les re-logins entre tests.
- **E2E — extension multi-navigateurs** : suite passée de 4 à 31 tests,
  couvrant Chromium, Firefox et WebKit ; flows admin (lignes, arrêts,
  messages, utilisateurs, appareils, horaires), carte réseau, kiosk et hub.
- **E2E — régression visuelle** : captures de référence et assertions
  pixel-perfect intégrées dans la suite Playwright.
- **`AdminTokenDialogComponent`** : révélation du token d'appareil migrée
  vers un `MatDialog` dédié, remplaçant l'inline toggle ; standardisation des
  options de paginateur sur toutes les listes admin.

### Changed

- **`GtfsImportService` décomposé en 17 `*Importer`** : orchestrateur réduit
  de 2829 à 440 LoC ; chaque section GTFS (agences, arrêts, routes, formes,
  voyages, horaires, transferts, cheminements, niveaux, traductions,
  attributions, règles de réservation, zones, groupes de zones, tarifs V1 et
  V2, itinéraires) isolée dans un composant Spring testable
  individuellement.
- **Dashboard / Lignes / Arrêts migrés vers `rxResource`** : chargement des
  données en syntaxe signal déclarative, supprimant les `BehaviorSubject` et
  les souscriptions manuelles.
- **`role=alertdialog` sur `ConfirmDialogComponent`** : boîte de dialogue
  destructrice conforme WAI-ARIA pour les lecteurs d'écran.
- **`role=alert` sur l'erreur de connexion** : message d'erreur du formulaire
  de login annoncé immédiatement par les technologies d'assistance.
- **`role=application` restreint sur le schéma** : portée de la région
  interactive resserrée au seul conteneur SVG du schéma réseau, limitant
  l'interférence avec la navigation clavier globale.
- **Kiosque — remplacement du défilement continu** : sous
  `prefers-reduced-motion`, le carrousel kiosk bascule d'un scroll continu
  vers des sauts de page discrets.
- **Standardisation du paginateur** : toutes les listes admin partagent
  désormais les mêmes options `[5, 10, 25]` et le même composant `MatPaginator`.
- **Guide développeur allégé** : suppression du snippet SockJS (remplacé par
  le client WebSocket natif), retrait de la carte de packages obsolètes.

### Internal

- **`@WebMvcTest` sur les contrôleurs en lecture seule** : tranches de test
  légères pilotant `NetworkMapController`, `FeedInfoController` et
  `StopController` sans contexte applicatif complet.
- **`@ParameterizedTest` sur les suites de validation** : couverture des
  variantes d'entrée invalides et du mapping d'exceptions via JUnit 5
  paramétré.
- **Refactorisation des tests structurels** : réorganisation des specs de
  structure de packages et d'architecture pour coller à la nouvelle
  décomposition en `*Importer`.
- **`@axe-core/playwright` en devDependency** : bibliothèque d'audit
  d'accessibilité automatisé ajoutée uniquement à l'environnement de
  développement/CI.

## [1.2.0] — 2026-05-11

Sprint 3: défense en profondeur (sécurité HTTP, JWT, WebSocket), déduplication
backend (caches GTFS-RT, helpers, scope resolver), et optimisations de
performance (requêtes schedule, JPA Specifications, assets Angular).
Aucun changement cassant, aucune modification de schéma de base de données.

### Security

- **Defense-in-depth HTTP header chain**: chaîne de réponses complète
  (Content-Security-Policy, HSTS, X-Content-Type-Options, Referrer-Policy,
  Permissions-Policy) ; matchers actuator et openapi resserrés pour exclure
  le filtre CSRF là où il est inutile.
- **JWT iss/aud + validation du secret au démarrage**: les tokens émis
  portent désormais les claims `iss` et `aud` ; la longueur minimale du
  secret JWT (256 bits) est vérifiée à l'initialisation de l'application,
  échec rapide avant acceptation de trafic. Coût BCrypt fixé à 12.
- **Liaison session STOMP au token d'appareil + sandbox du rapport de
  validation**: le token d'appareil est désormais lié à la session STOMP
  côté serveur ; le rapport HTML de validation des entrées est servi avec
  l'attribut `sandbox` pour empêcher l'exécution de scripts injectés.

### Changed

- **`BaseStompService` extrait**: logique commune aux 3 services WebSocket
  (connexion, reconnexion, souscription, teardown) centralisée dans une
  classe de base abstraite, éliminant ~120 lignes dupliquées.
- **`NgOptimizedImage` pour les assets logo**: les balises `<img>` statiques
  du logo remplacées par la directive Angular `NgOptimizedImage`, supprimant
  les avertissements CLS et activant le lazy-loading natif.
- **`AbstractRealtimeFeedCache`**: classe abstraite commune extraite des 3
  caches GTFS-RT (vehicle positions, trip updates, service alerts), éliminant
  la duplication de la logique de TTL, de refresh et de verrouillage.
- **Helpers de parsing + `MessageScopeResolver` consolidés**: méthodes
  utilitaires GTFS éparpillées regroupées dans `GtfsParse` ; la logique de
  résolution de scope des messages extraite dans un composant dédié.
- **Collapse des requêtes de schedules**: 6 requêtes de planning distinctes
  fusionnées en 2 variantes de fenêtre temporelle, réduisant la charge SQL
  sur les endpoints de consultation d'horaires.
- **Pré-intersection des arrêts affectés (scope NETWORK)**: les arrêts
  concernés par un message de portée réseau sont pré-intersectés avec le
  tracker actif au moment de la résolution, évitant un filtrage complet à
  chaque requête.
- **JPA Specifications pour le listing des messages**: les cascades de
  conditions `if/filter` remplacées par des `Specification<Message>` JPA
  composables, simplifiant la construction de requêtes dynamiques et
  facilitant les tests unitaires du prédicat.

### Internal

- **Alignement du budget bundle**: le seuil de budget Angular ajusté à la
  taille de production mesurée (555 kB), supprimant les avertissements de
  build sans assouplir la contrainte effective.

## [1.1.0] — 2026-05-11

Sprint 2: internationalisation complète côté admin et displays, helpers
frontend, modernisation des patterns Angular, et infrastructure CI/release.
Aucun changement cassant, aucune modification de schéma de base de données.

### Added

- **Transloco coverage — admin surface (15 composants)**: navigation du
  layout admin, puis les features lignes, arrêts, messages, utilisateurs,
  appareils, horaires, itinéraires, temps-réel, audit d'import, fiche
  feed-info, tableau de bord, données GTFS, cheminements, formes,
  zones TAD, calculateur tarifaire, et fenêtres flex-stop-times câblées
  avec `TranslocoModule` et clés extraites dans `fr.json` / `en.json`.
- **Transloco coverage — displays passagers**: kiosque et hub traduits
  (labels d'arrêt, messages temps-réel, indicateurs d'accessibilité,
  écran de chargement).
- **Formatage de date sensible à la locale**: les formateurs de date du
  kiosque et du hub respectent désormais la locale active (FR/EN) via
  `TranslocoService`, sans rechargement de page.

### Changed

- **`NotifyService`**: wrapper centralisé autour de `MatSnackBar` remplaçant
  60+ littéraux `snackBar.open(...)` dispersés dans les composants admin.
- **`httpErrorMessage`**: helper typé extrayant le message d'erreur HTTP,
  éliminant 28 duplications de blocs `catch`.
- **`pageRequestToHttpParams`**: helper supprimant la construction inline
  de `HttpParams` dans 8 data services.
- **`AdminTableState` étendu** aux features lignes et messages; état de
  page, colonne de tri et terme de recherche gérés de façon centralisée.
- **Migration `takeUntilDestroyed`**: pattern `Subject<void>` + `takeUntil`
  remplacé par l'opérateur Angular `takeUntilDestroyed` dans 8 composants.

### Internal

- **Workflow de release** (`release.yml`): build multi-arch Docker, push
  GHCR et création de GitHub Releases déclenchés sur tag `v*`.
- **Dependabot** configuré pour les dépendances npm et Gradle (mises à
  jour hebdomadaires groupées).
- **`.editorconfig`** ajouté à la racine pour homogénéiser l'indentation
  et le retour chariot entre éditeurs.
- **Seuil de couverture frontend**: floor Vitest ajouté en CI; la PR est
  bloquée si la couverture d'instructions descend sous le seuil.
- **Backend — Hikari pool**: taille de pool et timeouts configurés
  explicitement dans `application.yml`.
- **Backend — build info**: endpoint `/actuator/info` expose désormais la
  version et le commit SHA via Spring Boot Build Info.
- **Backend — constructor injection** sur `GtfsCoverageMetrics`; gardes
  de log redondants supprimés.
- **`test(network-map)`**: spec `next-flex-window` rendue robuste aux
  variations d'heure de la journée.

## [1.0.1] — 2026-05-10

Post-1.0 hardening and cleanup: three security fixes, several
correctness fixes identified by static analysis (SpotBugs, PMD)
and coverage enforcement, toolchain bumps, and a dead-weight
removal pass. No breaking changes, no new user-facing features.

### Security

- **Whitelist `sortBy` query parameters** on all paginated admin
  endpoints. Previously any column name was forwarded to the JPA
  `Sort` expression; now only the declared sortable fields are
  accepted, returning 400 on unknown values.
- **Block tracked `.env` file** in CI: a pre-push hook and a
  dedicated GitHub Actions step abort the push when a `.env`
  file carrying real secrets is tracked by git.
- **Gate the default-credentials hint** behind `isDevMode()`.
  The login page used to display a helper hint with the seeded
  admin password in all environments; the hint is now suppressed
  in production builds.

### Fixed

- **Kiosk Spring profile**: added a dedicated `kiosk` profile
  that enforces `JWT_SECRET` to be set, preventing accidental
  startup with the default insecure value in production.
- **`/map/list` column keys and eager `LocaleService`**: fixed
  wrong i18n keys on the tabular network-map alternative and
  ensured `LocaleService` initialises before the first render.
- **Realtime multi-catch**: split an `instanceof`-guarded
  multi-catch in the GTFS-RT pipeline into separate catch blocks
  to satisfy the compiler and avoid a silent swallow.
- **Frontend ESLint warnings** (7 occurrences): unused imports,
  unnecessary type assertions and stale `@ts-ignore` comments
  cleared by the ESLint 10 stricter rule set.
- **`serialVersionUID`** pinned on six `Serializable` JPA entity
  types flagged by SpotBugs `SE_NO_SERIALVERSIONID`.
- **`findAll(Pageable)` override** marked `@Override` explicitly
  on six repository interfaces where the compiler did not see the
  parent signature (PMD `MissingOverride`).
- **`GtfsImportService`**: return `Optional<Boolean>` instead of
  nullable `Boolean`; locale locked to `Locale.ROOT` on the
  import side to avoid locale-sensitive string comparisons.
- **`GtfsDownloader`**: `HttpClient` now closed in a
  try-with-resources block; SHA-256 hash forced to UTF-8; cache
  key normalised with `Locale.ROOT`.
- **Frontend coverage reporters**: `@vitest/coverage-v8`
  reporters now declared explicitly in `vitest.config.ts` so
  the CI artifact upload finds the LCOV file.
- **`jacocoTestCoverageVerification`** wired into the Gradle
  `check` lifecycle so the minimum instruction ratio (0.55) is
  enforced on `./gradlew check`, not just during a separate task.
- **STOMP client factory injected** in the frontend specs so
  unit tests can swap the client without touching
  `window.location`.

### Changed

- **License metadata** in `package.json` and `build.gradle.kts`
  aligned with the `AGPL-3.0-only` SPDX identifier to match the
  `LICENSE` file.
- **Admin table state centralised**: page index, sort column and
  search term are now managed in a shared service rather than
  duplicated per-table component.
- **`Pageables` helper** extracted on the backend to build
  `PageRequest` objects from validated sort parameters, replacing
  inline construction spread across controllers.
- **`docs/api.md` 971 → 178 lines.** Endpoint catalogue removed —
  Swagger UI at `/swagger-ui.html` is now the single source of
  truth. The file keeps the cross-cutting parts only (auth flow,
  error format, WebSocket usage, GTFS coverage tables, custom
  Prometheus meters).
- **`backend/build.gradle.kts`**: `jmhImplementation` no longer
  extends `runtimeOnly` (only the removed integration bench
  needed the production runtime classpath).

### Removed

- **`sockjs-client` + `@types/sockjs-client`** (and the matching
  `.withSockJS()` call in `WebSocketConfig`). STOMP now uses the
  native WebSocket transport; the three frontend services compute
  `brokerURL` from `window.location`. Targets only Chromium-based
  kiosks, so the HTTP-streaming fallback was never going to fire.
- **`@fontsource/roboto`**. Inter is the only typeface the styles
  actually used; the hub fell back to Inter, the two `Roboto Mono`
  references switched to system `monospace`.
- **`DisplayStateCalculatorIntegrationBenchmark`** (full-stack JMH
  bench booting a Spring Boot context per fork). Six service-level
  micro-benchmarks remain; ADR 0028 updated.
- **`docs/announcements/`** — channel-specific announcement drafts
  (Show HN, Reddit, Mastodon, LinkedIn, awesome-transit, Devoxx)
  moved out of the public repo. ADR 0038 compressed accordingly.
- Empty `infrastructure/layout/` package and orphan
  `docs/mvp-brief.md`.
- Dead public methods uncovered by a usage audit:
  `ItineraryService.getItineraryEntity`, `LineService.getLineEntity`,
  `StopService.getStopEntity` (only ever called from their own unit
  tests), `GtfsValidatorService.NoticeSummary.totalNotices` (never
  called) and `Stop.removeLine` (no reference anywhere). Associated
  unit-test blocks dropped accordingly. Backend compile + 950+
  tests green.
- **`excludingId` parameter** on `UserService` removed (unused
  across all callers).
- **`EnumSet` → `Set`** in GTFS helpers: widened the return type,
  dropped manual unboxing and an unused dead parameter.

### Internal

- **Quality gate**: `./gradlew check` now runs JaCoCo coverage
  verification, SpotBugs and PMD in addition to the test suite.
  SpotBugs, PMD, `versions` and OWASP dependency-check plugins
  wired in `build.gradle.kts`.
- **Pre-push hook** (Husky): runs lint + knip + `check` on the
  touched stack so quality regressions are caught before the push.
- **E2E and dependency-check CI workflows** added alongside the
  existing backend/frontend workflows.
- **Hidden source maps** emitted in the production frontend build
  for post-deploy error symbolication without exposing source to
  end users.
- **jscpd defaults pinned** and its report output directory added
  to `.gitignore`.
- **Dependency bumps**: TypeScript 6 (frontend, dropped deprecated
  `baseUrl`), ESLint 10, knip 6, jsdom 29, springdoc-openapi
  2.8.6, Gradle wrapper + pinned backend deps, protobuf plugin
  0.9.5.
- **GTFS-RT cache unit tests** added for the three cache classes
  (`AlertCache`, `TripUpdateCache`, `VehiclePositionCache`).
- **Network-map spec fixtures hoisted** into shared helpers to
  eliminate duplication across the route-result specs.
- **Redundant knip ignore entries** for spec files and `.d.ts`
  auto-handled paths removed.

## [1.0.0] — 2026-05-10

### Headline

First stable release. Transit Display Hub now ships with 100 %
GTFS spec coverage validated by the canonical
MobilityData runner, WCAG 2.2 AA accessibility on every persona
(kiosk, admin, map), runtime FR/EN switching, automated quality
gates (JaCoCo, Vitest coverage, Playwright smoke E2E, GitHub
Actions CI) and a turnkey Raspberry-Pi kiosk deployment recipe.

### Phase B — Recognition surface (May 2026)

Lighter than the original plan because the owner declined both
heavy chantiers (online demo, standalone marketing site). What
ships under `docs/` instead:

- **`.github/ISSUE_TEMPLATE/`** structured forms (bug + feature)
  plus a config disabling blank issues; **PR template**
  mirroring the ADR style.
- **`SECURITY.md`** spelling out the private-disclosure path,
  supported versions and 60-day public timeline.
- **`docs/screenshots/`** scaffolding with capture conventions
  documented; the README references six expected captures
  (admin dashboard, network map, stop popup, kiosk, import
  audit, tabular alternative).
- **`docs/announcements/`** seven ready-to-paste channel-
  specific drafts (Show HN, Reddit ×4, Mastodon EN+FR,
  LinkedIn, MobilityData/awesome-transit PR,
  transport.data.gouv.fr forum + Slack, Devoxx FR / Mix-IT /
  Touraine Tech CFP). Owner picks the day and edits the body.
- **README** restructured around a tagline, a "Why this
  exists" section, badges (backend CI, frontend CI, license,
  ADR count) and a six-row screenshots table linking back to
  `docs/screenshots/`.
- **ADR 0038** records the strategy: GitHub README is the
  canonical landing surface, no separate site, no online demo,
  community surface in place via templates and SECURITY.md.

The entries below summarise what landed across milestones 0.9.0
through 0.15.0. Detailed release notes for each milestone are
preserved verbatim in the sections that follow.

### Summary of milestones folded into 1.0.0

| Milestone | Theme | Highlights |
|---|---|---|
| 0.9.0  | GTFS spec 100 % | mean_duration_*, RT FeedHeader + TripUpdate.vehicle, gtfs-validator integration, ADR 0034 |
| 0.10.0 | Accessibility WCAG 2.2 AA | High-contrast palette, large-text mode, Web Speech API, /map/list tabular alternative, ADR 0035 |
| 0.11.0 | Runtime i18n (Transloco) | LocaleService, fr.json + en.json, kiosk + map migrated, ADR 0036 |
| 0.12.0 | Quality gates + CI | JaCoCo, Vitest coverage, Playwright smoke E2E, two GitHub Actions workflows, ADR 0037 |
| 0.13.0 | Routing voyageur | Already covered by RouteFinderService + ADR 0032 (no new code) |
| 0.14.0 | Raspberry Pi kiosk | docker-compose.kiosk.yml, install.sh, docs/kiosk-raspberry-pi.md |
| 0.15.0 | Polish UX | 404 page redesigned with public + admin CTAs, i18n keys |

### Tag

This release is tagged `v1.0.0`.

---

### Pre-1.0 milestone notes (folded into 1.0.0 tag)

#### Added — 0.12.0 milestone : Quality gates and CI (May 2026)

Wires automated quality signals around the project so a
regression below the current baseline is caught without manual
inspection.

- **Backend coverage**: JaCoCo plugin enabled in
  `backend/build.gradle.kts`. `check` depends on
  `jacocoTestReport`. Minimum bundle-level instruction ratio
  pinned at 0.55. Generated GtfsRealtime protobuf code is
  excluded from the denominator.
- **Frontend coverage**: `@vitest/coverage-v8` added; new
  `npm run test:coverage` script. Default `npm test` left
  unchanged so the watch-mode feedback loop is preserved.
- **E2E smoke suite**: Playwright (1.59) reintroduced with a
  Chromium-only project and three scenarios (network map,
  tabular alt, login form keyboard navigation).
- **CI**: two GitHub Actions workflows (`backend.yml`,
  `frontend.yml`) gated on path filters, official `actions/*`
  steps only, JaCoCo and Vitest coverage uploaded as 7-day
  artifacts.
- **ADR 0037** documents the choices: minimum coverage
  threshold, Chromium-only Playwright, no webServer block,
  no Codecov badge.

#### Added — 0.11.0 milestone : Runtime i18n via Transloco (May 2026)

Lays down the runtime translation infrastructure with French as
the default and English as the second shipped locale. Documents
the architectural choice in ADR 0036.

- `@jsverse/transloco` (MIT) wired via `provideAppTransloco()` in
  `app.config.ts`. JSON dictionaries lazy-loaded from
  `assets/i18n/<lang>.json` on first reference.
- `LocaleService` exposes a `current()` signal + `toggle()` /
  `setLang()` mutators. Initial language resolution: localStorage
  → `navigator.language` prefix match → Transloco default ('fr').
- `assets/i18n/fr.json` and `assets/i18n/en.json` ship the four
  initial namespaces (`common`, `kiosk`, `map`, `admin`) plus
  every label needed by the freshly migrated components.
- First wave of migrated components: Kiosk a11y toolbar, Network
  map header, Network list page. The remaining admin browsers /
  login / feature pages keep their FR literals; the JSON
  dictionaries already cover their keys for a follow-up batch.
- The `/map` header gains a 'EN/FR' toggle button calling
  `LocaleService.toggle()`.

#### Added — 0.10.0 milestone : Accessibility foundations (May 2026)

Brings the project to WCAG 2.2 AA on every persona (kiosk
passenger, admin operator, map visitor). All commits keep the
existing test suites green.

**Kiosk**
- `ThemeService` grows three orthogonal signals: `isDarkMode`
  (existing), `isHighContrast` (new, defaults to
  `prefers-contrast: more`) and `isLargeText` (new). Each is
  persisted to localStorage independently — a low-vision user
  can stack high-contrast + large-text + dark mode.
- The kiosk header gains a three-button a11y toolbar:
  high-contrast toggle, large-text toggle and a vocal-
  announcement button reading the head of the arrivals board
  through `window.speechSynthesis` ("ligne X, direction Y, à
  HH:MM, retardé de N minutes" when realtime data is present).
- Style overrides land in the global `styles.scss` under
  `.high-contrast-theme` / `.large-text-theme` so any other
  route hosting the same toggles inherits the look.

**Network map**
- New `/map/list` route with a `NetworkListComponent` ships every
  line and every stop the SVG schematic exposes in a tabular
  structure screen readers and keyboard-only users can consume
  directly. Three filters mirror the visual controls: stop name
  search, wheelchair-accessible only, on-demand-only. Filters
  combine with AND semantics.
- The schematic page gains a "Vue liste" link in its header
  (aria-label: "Vue tabulaire accessible — clavier / lecteur
  d'écran").

**Architectural decision**
- ADR 0035 records the three-signal design (vs. a single mode
  enum), the high-contrast variable overrides (vs. a separate
  Material theme), the Web Speech API choice (vs. server-side
  TTS) and the parallel-route table (vs. SVG keyboard
  retrofitting).

#### Added — 0.9.0 milestone : 100 % GTFS spec coverage + MobilityData validator (May 2026)

Closes the last documented field gaps and wires the canonical
[MobilityData gtfs-validator] (Apache 2.0) into the import pipeline.
All commits keep the existing test suites green (backend + 950
frontend tests) and land sequentially on `main`.

**Schedule / Realtime field-level closures**
- `Itinerary` gains `mean_duration_factor` / `mean_duration_offset`
  (GTFS-flex 2024 trip-level fields), persisted via Flyway V48 and
  parsed from `trips.txt` alongside the existing `safe_duration_*`
  pair.
- New `FeedHeaderInfo` record captured on every realtime cache
  refresh — alerts, trip updates and vehicle positions all expose
  `currentHeader()` so consumers can validate freshness and detect
  differential updates (`gtfs_realtime_version`, `incrementality`,
  `timestamp`).
- `RealtimeTripUpdateCache.TripAdjustment` carries the
  `TripUpdate.vehicle` VehicleDescriptor (`vehicleId`,
  `vehicleLabel`) plus the per-trip `timestamp`. The local
  `gtfs-realtime.proto` subset gains the missing
  `optional VehicleDescriptor vehicle = 3` field at the
  upstream-canonical position.

**Test fixtures**
- `gtfs-rich/` (classpath fixture) now ships `shapes.txt`,
  `frequencies.txt` and the four trip-level duration columns
  (`safe_duration_*` + `mean_duration_*`) so every GTFS file
  documented by the reference has a row exercising it.

**MobilityData runner integration (ADR 0034)**
- `GtfsValidatorService` wraps `ValidationRunner` (8.0.0). Returns
  the on-disk paths of `report.json`, `report.html` and
  `system_errors.json`, plus a pre-counted `NoticeSummary`
  (errors + warnings + infos).
- `GtfsImportOrchestrator` invokes the validator on every
  successful import. Outcome lands on the matching `ImportAudit`
  row (`validation_report_dir`, `validation_status`,
  `validation_notice_errors`, `validation_notice_warnings`) via
  Flyway V49. Validator failures never demote the import itself.
- `GET /api/admin/import-audit/{id}/validation-report` and
  `…/validation-report.html` serve the runner artefacts back to
  the admin UI. Service whitelists three filenames to keep the
  endpoint from doubling as a directory traversal sink.
- `/admin/import-audit` table grows a "Validation" column with
  ERROR / WARNING badges and an open-in-new icon button linking
  to the HTML report.
- Configurable via `app.gtfs.validation.enabled` (default `true`)
  and `app.gtfs.validation.report-base-dir`
  (default `${java.io.tmpdir}/gtfs-validation`).

[MobilityData gtfs-validator]: https://github.com/MobilityData/gtfs-validator

#### Removed — GTFS-centric scope cleanup (May 2026)

A full audit of the codebase against the GTFS spec and current
consumers identified the unused / non-GTFS surface. Ten atomic commits
remove ~2 700 LOC without touching any feature still in use. Knip and
the test suites (backend + 950 frontend tests) remain green.

**Backend**
- 9 unused JPA repository methods: `StopRepository.findByLineIdWithLines`
  + `findAllByIdInWithLines` slim variants, the four
  `findByExternalId` (Agency, Location, RiderCategory, ServiceCalendar),
  `BroadcastMessageRepository.findByScopeTypeAndScopeId`,
  `DeviceRepository.findByTokenHash` (replaced by
  `findByTokenLookup` + BCrypt), and three on `FlexStopTimeRepository`.
- `POST /api/devices/authenticate` + its DTO, security rule, doc and
  five tests — the kiosk auth flow uses the `X-Device-Token` header
  on `GET /api/display`.
- `SyntheticDataLoader` (1 041 LOC). The classpath `gtfs-rich`
  fixture covers the offline demo path.
- The agencies surface end-to-end: `AgencyController`, `AgencyService`,
  `AgencyResponse` DTO and integration test. The `Agency` entity
  stays — `Line.agency`, `FareAttribute.agency`,
  `GtfsImportService` and `DataOverviewService` still need it.

**Frontend**
- `DisplayLayoutComponent` (orphan layout — `/display` loads
  `KioskComponent` directly).
- `AgencyService` + `Agency` interface (no consumer).
- Dashboard: dead `allMessages` signal, `readableTextColor` alias,
  matching test.
- BreakpointService: unused `isTablet` / `isDesktop` / `isHandset`
  signals (only `isMobile` and `isSmallScreen` are read).
- Six dead `service.get(id)` methods (line, stop, itinerary, message,
  device, user), `userService.getAll`, `deviceService.update` plus
  their test blocks. Admin pages already use `getAllPaginated` and
  pass row data through dialog inputs.
- Dependencies: `@angular/animations` (Material 21 no longer requires
  it; `inject(ANIMATION_MODULE_TYPE, { optional: true })` falls back
  gracefully), `puppeteer` (doublon of Playwright),
  `playwright` + `@playwright/test` (only consumer was the ad-hoc
  `test-visual-2.js` script).
- Trivia: orphan `favicon-48x48.png`, dead `@environments/*` tsconfig
  alias, `test-visual-2.js` debug script.

#### Added — GTFS data exploitation pass (Phases 1-8)

After the V36-V47 spec-coverage pass closed every persistence gap,
this pass turns the data into product features. Eight phases, ~25
commits, four new ADRs.

**Phase 1 — affichages low-hanging fruits**
- Admin Lines: badges "Hop-on/hop-off" (continuous_pickup) and
  "Sans contact" (cemv_support).
- Admin Itineraries: badges direction (Aller/Retour from
  `direction_id`) and "Voitures" (cars_allowed).
- Admin Stops: badges "Zone X" (zone_id) and "Personnel"
  (stop_access=1).
- Dashboard: feed_lang / default_lang in the FeedInfoCard.
- Dashboard + Network Map: footer `<app-feed-credits>` listing
  Attribution organisations with role pills (producer / operator /
  authority).
- Stop popup: BookingRule details (phone, URL, prior notice, message)
  via new public endpoint `GET /api/network-map/stops/{id}/booking-rules`.

**Phase 2 — indoor navigation (Pathways + Levels)**
- New public endpoint
  `GET /api/network-map/stops/{id}/pathways` returning the indoor
  graph rooted at the stop's parent station.
- New `<app-pathway-list>` component embedded in the stop popup.
- Admin Pathways page also shows the station's level chips.
- ADR 0031.

**Phase 3 — TAD enrichi (BookingRule + FlexStopTime)**
- New `FlexAvailabilityService` + endpoints
  `GET /api/admin/flex-stop-times` and
  `GET /api/network-map/locations/{externalId}/flex-windows?date=…`.
- New admin page `/admin/flex-stop-times` listing every flex window
  with its target (stop / location / location group), times and
  booking rules.

**Phase 4 — Routing PMR (accessible-only)**
- `RouteFinderService.findRoute` accepts `RouteFinderOptions
  { accessibleOnly }` that prunes stops with
  `wheelchair_boarding=NOT_ACCESSIBLE`.
- Toggle button "PMR uniquement" on the network-map page.
- ADR 0032.

**Phase 5 — FareCalculator V1 + V2**
- New `FareCalculatorService` + public endpoint
  `GET /api/fares/calculate?from=…&to=…` running V1 (zone_id +
  fare_rules) and V2 (Areas + fare_leg_rules) pipelines side by side.
- New admin page `/admin/fare-calculator` with origin/destination
  pickers and dual-table results.
- ADR 0033.

**Phase 6 — Real-time enrichi**
- `VehiclePositionResponse` already exposes `occupancyStatus`,
  `occupancyPercentage`, `bearing`, `congestionLevel` —
  surfaced unchanged for downstream consumers.
- Admin temps-réel: occupancy badge (Disponible / Bondé / Plein),
  bearing arrow rotated by the GTFS-RT angle, congestion column.

**Phase 7 — Translations élargies**
- `TranslationLookup` now keys on
  `(table_name, record_id, record_sub_id, field_name, language_context)`
  and supports the spec's `field_value` matching mode via
  `resolveByFieldValue`.
- `DisplayStateCalculator` now passes the trip_id as `record_sub_id`
  when looking up `stop_times.stop_headsign` translations, so loop
  services with per-trip headsigns get the right localised label.

**Phase 8 — observabilité**
- New `GtfsCoverageMetrics` exposes a Prometheus gauge
  `gtfs_entity_count{kind=…}` per entity family
  (translations, attributions, pathways, levels, flex_stop_times,
  locations, location_groups, booking_rules, areas, networks,
  timeframes, fare_*_rules, rider_categories).
- New `fare_calculation_duration` Timer with p50/p95/p99 percentiles.
- Grafana README documents the suggested additional panel queries.
- ADR 0031 (indoor pathway), 0032 (accessibility-aware routing),
  0033 (FareCalculator V1+V2).

#### Wrapping the deferred backlog

The five sub-tasks left under "Known follow-ups (deferred)" after the
GTFS exploitation sprint all landed in a follow-up pass:

- **Stop popup — fare price + next flex window**: `originStop` propagates
  from `network-map.component` into `StopPopupData`. The popup queries
  `/api/fares/calculate` for the (origin, target) pair and renders the
  V2 amount with V1 fallback. When the stop has a TAD zone,
  `/flex-windows` is queried for today and the earliest upcoming window
  is surfaced with its headsign.
- **Routing PMR — pathway penalty + transfer route qualifiers**:
  `NetworkMapResponse.NetworkTransfer` now exposes
  `fromLineId` / `toLineId` (resolved from
  `Transfer.from_route_id` / `to_route_id`) and the dedupe key keeps a
  generic + a route-specific entry side by side. The Dijkstra
  route-finder picks the most-specific applicable transfer per
  (lineI, lineJ) pair. A new `pathwayPenaltySeconds` option adds extra
  cost to implicit interchanges (no `transfers.txt` entry); the PMR
  toggle wires it to 120s so accessibility-aware searches favour
  explicitly-modelled interchanges.
- **Admin pathways — SVG graph**: `PathwaysComponent` now renders a
  BFS topological graph above the segment table — column = depth,
  row = arrival order, edges colored by mode (`STAIRS` dashed,
  one-way pathways carry an arrowhead). Stroke width scales with
  `traversal_time`. Legend lists every mode used in the current graph.
- **Grafana JSON pinning**: dashboard JSON now ships two extra rows —
  GTFS coverage (table panel grouped by `kind`) and Fare calculator
  (request rate + p50/p95/p99 latency). README updated.
- **JMH benches for the new services**:
  `FareCalculatorServiceBenchmark`, `FlexAvailabilityServiceBenchmark`,
  `PathwayServiceBenchmark` join the existing micro-bench suite under
  `src/jmh/java/com/transit/hub/bench/`. Repositories stubbed with
  Mockito (added to `jmhImplementation`) so the measurement isolates
  service-side filtering / sorting from JPA round-trips. Run with
  `./gradlew jmh -Pjmh.include=".*ServiceBenchmark.*"`. Live numbers
  on a developer laptop (default `warmup=2`/`iter=3`/`fork=1`):
  `calculate` 44/53/148 µs (catalogSize=10/100/1000),
  `findToday` 10/20/64 µs (windowCount=10/100/500),
  `findStationGraph` 25/31/64 µs (pathwayCount=5/30/200) —
  every result well under the 50 ms target documented in
  `project_deferred_backlog`.

#### Added — offline rich-fixture seed (May 2026)

`src/main/resources/fixtures/gtfs-rich/` ships an in-classpath GTFS
feed that exercises every spec surface the importer supports
(pathways, fares V1+V2, translations, GTFS-flex, transfer qualifiers,
attributions, levels, networks, timeframes, rider categories,
fare media, location groups). Activate with:

```
DATA_LOADER_GTFS_URL=classpath:fixtures/gtfs-rich/
DATA_LOADER_GTFS_NETWORK_NAME="Rich Demo"
```

`GtfsDownloader` resolves `classpath:` URLs by zipping the
sub-directory at runtime — works the same on a developer machine and
inside the Docker image. Used during the deferred-backlog wrap-up
validation pass to manually walk every popup section, every admin
page and every metric without depending on a public feed.

#### Fixed

- `gtfs_entity_count{kind=…}` was returning `NaN` on every Prometheus
  scrape because `MeterRegistry.gauge` keeps a weak reference to the
  state object — once the bound supplier lambda went out of scope the
  JVM GC'd it. Switched to `Gauge.builder(name, Supplier<Number>)`
  which retains a strong reference. Confirmed post-fix that every
  `kind` publishes a real value (commit `c8dd663`).
- The TAD on-demand badge missed stops referenced only by GTFS-flex
  rows: `findStopIdsWithOnDemandPickup()` only scanned
  `Schedule.pickupType`. Added a parallel
  `flexStopTimeRepository.findStopIdsTouchedByFlex()` and merged the
  two sets in `NetworkMapService.getNetworkMap` so a stop reachable
  via a `flex_stop_times` row also lights up on the schematic.
- `GtfsImportService` dropped `stop_times.txt` rows that combined
  `stop_id` with a pickup window but no concrete `arrival_time` — a
  legitimate GTFS-flex shape. Extended the {@code isFlexRow} check
  so the row lands in `flex_stop_times` and the stop gets the
  on-demand badge.

#### Added — full GTFS-spec coverage pass (V36 → V47)

The May audit catalogued every field gap between
`GtfsImportService` and the live gtfs.org reference. This
pass closes them. **Pure additive**, no UI surface
touched (the network map keeps its schematic rendering;
shapes data is persisted but not drawn geographically).

**`stop_times.txt` rounded out (P1):**
- **GTFS-flex windows + targets**:
  `start_pickup_drop_off_window`,
  `end_pickup_drop_off_window`, `location_id`,
  `location_group_id` now persist on a new
  `flex_stop_times` table — kept separate from
  `schedules` because flex rows describe *availability
  over a window* rather than concrete arrivals at a stop.
  The importer routes rows automatically and resolves
  `pickup_booking_rule_id` / `drop_off_booking_rule_id`
  FKs.
- **`departure_time` distinct from arrival**: previously
  collapsed into a single `time` column; now persisted
  only when the feed actually distinguishes them.
- **`continuous_pickup` / `continuous_drop_off`** at the
  stop-time level (override of the route-level values
  already persisted on `Line`).
- **`shape_dist_traveled`** — distance along the shape
  from trip start, useful for in-vehicle progress
  indicators.

**`stops.txt` (P1, P3):**
- **`zone_id`** — the foreign-key target of `fare_rules`
  (`origin_id` / `destination_id` / `contains_id`);
  without it the V1 fare table was unusable.
- **`stop_access`** (post-2023 spec field).

**`trips.txt` (P1, P3):**
- **`direction_id`** persisted on `Itinerary` (previously
  used in-memory only to group trips).
- **`cars_allowed`** (motorail / ferry policy) — new
  `CarsAllowed` enum mirroring `BikesAllowed`.
- **`safe_duration_factor`** / **`safe_duration_offset`**
  for on-demand booking ETA estimation.

**`transfers.txt` (P2):**
- **`from_route_id`**, **`to_route_id`**,
  **`from_trip_id`**, **`to_trip_id`** qualifiers —
  without them, route-specific transfer rules collapsed
  into generic stop-to-stop edges.

**Fares V2 (P2, P3):**
- **`fare_leg_join_rules.txt`** aligned with the
  canonical spec layout (`leg_group_id`, `leg_sequence`,
  `preceding_trip_transfer_limit`); legacy MobilityData
  layout still accepted as fallback.
- **`rider_categories.txt`** — new entity, FK from
  `FareProduct.rider_category_id`.
- **`fare_transfer_rules`** boarding-time fields:
  `minutes_before_to_start_boarding_time`,
  `minutes_after_to_start_boarding_time`.

**`agency.txt` / `routes.txt` (P3):**
- **`cemv_support`** at both levels (contactless EMV
  acceptance, with route taking precedence over agency).

**`translations.txt` (P3):**
- **`record_sub_id`** (required when translating
  `stop_times` rows where `record_id` alone is
  ambiguous).
- **`language_context`** for disambiguating long-form vs
  short-form translations.
- Unique constraint widened to include `record_sub_id`.

**`locations.geojson` (P4):**
- Now reads `properties.name` (current spec) with
  `properties.stop_name` fallback (legacy / MobilityData
  fixtures).

**Validation (P4):**
- The importer warns when a feed reuses an id across
  `stops.stop_id`, `locations.geojson` Feature.id and
  `location_groups.location_group_id` — the spec mandates
  a single namespace and overlap makes `stop_times`
  references ambiguous.

Migrations: V36 (itinerary direction_id), V37 (stop
zone_id), V38 (flex_stop_times), V39 (schedule
departure_time), V40 (transfer qualifiers), V41
(fare_leg_join_rules canonical), V42 (schedule continuous
+ shape_dist), V43 (itinerary cars + safe_duration), V44
(stop_access + cemv_support), V45 (rider_categories), V46
(fare_transfer_rules boarding times), V47 (translation
sub_id + language_context).

#### Fixed
- **Synthetic data loader** now evicts the
  `networkMap` / `networkAlerts` Caffeine caches at the
  end of its run. A warm-up request issued by the dev
  frontend during boot could populate the cache with an
  empty snapshot before the seed completed, leaving the
  network map showing "No stops configured yet" until the
  5-minute TTL expired. `GtfsDataLoader` was already OK
  via `GtfsImportOrchestrator.evictNetworkCaches()`.

#### Security
- **Bumped Angular to 21.2.12** (and the rest of the
  frontend deps via `npm update`) to clear seven
  high-severity vulnerabilities, notably the
  `@angular/compiler` XSS in i18n attribute bindings
  (GHSA-g93w-mfhg-p222, fixed in 21.2.4). `npm audit` now
  reports zero vulnerabilities. The `npm update` also
  cleared an `@angular-devkit/core` advisory and a couple
  of transitives. ESLint's stricter
  `no-unnecessary-type-assertion` rule (new in
  angular-eslint 21.3.x) flagged ~30 type assertions and
  unused imports left over from earlier Angular minors —
  all fixed.
- `tsconfig.spec.json` now explicitly includes
  `src/test-setup.ts` so the new `@angular/build` doesn't
  drop it from the spec compilation.

## [0.8.3] - 2026-05-09

Closing pass on the post-0.8.2 backlog: the four items the previous
release left "on the table" all ship — TAD polygon in the public stop
popup, Grafana dashboard, full-stack DisplayStateCalculator benchmark,
spatial query on `locations`. Two new ADRs.

### Added
- **GTFS-flex zone polygon in the stop popup** on the network map.
  When the clicked stop has `hasOnDemand=true`, the popup now lazy-loads
  the zone polygon from the new public endpoint
  `GET /api/network-map/stops/{stopId}/tad-zone` and renders it inline
  in a 220-px SVG canvas. Falls back silently to the existing booking
  badge when the stop is on-demand but has no zone polygon. The
  `tad-zones.utils` were promoted to `@shared/utils/flex-locations.utils`
  so the schematic admin and the public stop popup share the same
  projection / ring-flattening helpers.
- **Grafana dashboard** at `ops/grafana/transit-display-hub.json` plus
  README. Four rows (HTTP / GTFS import / Caffeine cache / JVM)
  consume the Prometheus surface introduced in 0.8.2; every query is
  scoped to `application="transit-display-hub"` so the dashboard is
  portable across deployments.
- **Full-stack JMH benchmark** for `DisplayStateCalculator.calculateForStop`
  alongside the existing micro-benchmarks. Boots a real Spring Boot
  context with H2 in-memory, builds a parameterised fixture (5 / 30
  schedules) and measures the wall-clock cost of a kiosk refresh
  including the datasource round-trips. Lives at
  `backend/src/jmh/java/com/transit/hub/bench/integration/`. Per
  ADR 0028, the integration source set is kept separate from the
  micro-benchmarks so a Spring cold start doesn't pollute the
  pure-compute numbers.
- **Spatial query on `locations`** without JTS. New endpoint
  `GET /api/admin/locations/contains?lat=X&lon=Y` returns every flex
  zone whose polygon contains the input point. Two-step pipeline: SQL
  bounding-box pre-filter on the indexed min/max columns, then Java
  ray-casting on the GeoJSON via the new `PolygonContains` utility.
  Handles `Polygon`, `MultiPolygon`, holes (interior rings) and
  malformed input. ADR 0029 documents the trade-off (keeps ADR 0026
  intact — no JTS, no PostGIS, no schema change).
- **ADR 0029** — In-memory point-in-polygon for `locations.geojson`.

## [0.8.2] - 2026-05-09

Carte-blanche pass on top of 0.8.1: the three deferred items from the
post-0.8.1 backlog now ship — admin visualisation of GTFS-flex zones,
Prometheus metrology, JMH micro-benchmarks. Three new ADRs documenting
the design trade-offs.

### Added
- **Toggleable fare-zone color overlay** on the schematic stops. Adds
  a "Zones" toggle button next to the PMR filter that paints a
  translucent halo behind every stop coloured by its primary fare
  zone (deterministic HSL hash of the alphabetically-first
  `fareAreaName`). Orthogonal to the existing zone chip filter — the
  chip dims out-of-zone stops, the overlay paints in-zone stops. Off
  by default.
- **GTFS-flex `locations.geojson` import** (V35, ADR 0026). The
  importer now reads the FeatureCollection if present and persists
  each Feature as one `Location` row carrying the raw GeoJSON
  geometry as TEXT plus a pre-computed bounding box. Browse via the
  new admin endpoint `GET /api/admin/locations`. Deliberately avoids
  JTS / Hibernate Spatial — today's consumers (admin browser, future
  kiosk popup) only need the geometry round-tripped, not spatial
  queries.
- **Real-feed integration test suite** behind an opt-in Gradle task
  `./gradlew testRealFeed`. Parameterised over M Réso Grenoble, CTS
  Strasbourg and TBM Bordeaux: each test downloads the public feed
  via the existing `GtfsDownloader` cache and runs `importFromZip`
  end-to-end, asserting non-trivial domain shape (≥ 1 line, ≥ 50
  stops, ≥ 1 k schedules). Tagged `@real-feed`; the default test task
  excludes that tag so CI stays Internet-free. Each test self-skips
  via JUnit Assumptions when the upstream is unreachable.
- **TAD zones admin map** at `/admin/tad-zones`. SVG canvas rendering
  every imported `locations.geojson` polygon (Polygon + MultiPolygon),
  side panel with the zone list, click-to-highlight. Equirectangular
  projection with cosine-latitude correction, 8 % margin, deterministic
  golden-angle hue palette. No new map dependency — same trade-off as
  the existing shapes preview.
- **Prometheus scrape endpoint** at `/actuator/prometheus`, public
  alongside `/actuator/health`. New runtime dependency
  `micrometer-registry-prometheus` + custom `GtfsImportMetrics` that
  exposes `gtfs.import.duration` (histogram, p50/p95/p99),
  `gtfs.import.completed{status=success|failed|skipped}`, and
  `gtfs.import.entities{kind=lines|stops|schedules}`. Spring Boot
  Actuator's auto-binding picks up the existing JVM, HTTP server,
  datasource and Caffeine cache meters out of the box. Every meter
  carries the `application=transit-display-hub` tag for portable
  Grafana dashboards. ADR 0027.
- **JMH micro-benchmarks** for the three hot-path utilities:
  `ServiceCalendarMatcher.isActive` (parameterised by exception count
  0/5/50), `TranslationLookup.from` + `resolve` (parameterised by
  collection size 100/1k/10k), `ColorContrast.readableTextColor`
  (single-shot domain). Run via `./gradlew jmh`; the new task is
  intentionally outside the default `check` lifecycle so a JMH run
  never blocks CI. Source set lives at `backend/src/jmh/java/`.
  ADR 0028.
- **ADR 0026** — Persist `locations.geojson` as TEXT, no JTS.
- **ADR 0027** — Prometheus scrape via Micrometer, no in-house metrics
  layer.
- **ADR 0028** — JMH micro-benchmarks for hot-path utilities.

## [0.8.1] - 2026-05-09

Quality pass on top of 0.8.0: the after-Phase-1.3 / Fares-v2 work is now
backed by regression tests, every REST controller has integration
coverage, the dev boot logs zero warnings, and the admin pagination
paths no longer drag the entire result set into memory.

### Added
- **Regression tests on the post-Phase-1.3 surface.**
  `NetworkMapServiceTest` gets eleven new tests pinning parent /
  platform collapse, itinerary-stop UUID remap, intra-station transfer
  drop, parent-area / parent-line / hasOnDemand / wheelchair
  aggregation. `schematic-map.component.spec` adds thirteen tests on
  the accessibility filter, the zone chip filter, and the
  frequency-scaled stroke width. All previously shipped without
  coverage.
- **Integration coverage for the fifteen previously-untested REST
  controllers.** One `*ControllerIntegrationTest` per controller —
  AgencyController, AttributionController, BookingRuleController,
  DashboardController, DataOverviewController, FareController,
  FaresV2Controller, FeedInfoController, GtfsAdminController,
  ImportAuditController, PathwayController, RealtimeAlertController,
  RealtimeVehicleController, ShapeController, TranslationController.
  Every test asserts the auth tier (anon / agent / admin), the happy
  path shape, and the error edges (missing query param, unknown id,
  disabled feed). GtfsAdminController's reimport endpoint uses
  `@MockitoBean` on the orchestrator to pin the SUCCESS / FAILED /
  SKIPPED_UNCHANGED branches deterministically.
- **ADR 0023, 0024, 0025** documenting the two-step pagination
  pattern, the `Clock` injection rule for time-sensitive domain
  services, and the section-boundary flush strategy in the GTFS
  importer.

### Changed
- **Two-step pagination** across `LineRepository`,
  `ItineraryRepository` and `StopRepository`. Pages over ids first
  (no JOIN FETCH so SQL paginates), then hydrates the page's entities
  with their collections via `WHERE id IN (:ids)`. Replaces the
  paginated `WithStopsAndRoutes` / `WithLineAndStops` /
  `WithLinesAndDevices` queries that emitted HHH90003004
  ("firstResult/maxResults specified with collection fetch; applying
  in memory") on every paginated admin call. Pagination now scales
  with page size, not with table size.
- **`DisplayStateCalculator` takes a `Clock` dependency** instead of
  reading `LocalTime.now()` / `Instant.now()` directly. Production
  wires `Clock.systemDefaultZone()` via a new `ClockConfig` bean;
  tests pin `Clock.fixed(2026-01-15T10:00:00Z, Europe/Paris)` so the
  30-minute upcoming-departure window never crosses midnight at
  test-time. Fixes a pre-existing flake where running the suite past
  23:30 local rerouted the calculator to its cross-midnight branch
  and tripped Mockito's strict-stubbing audit on every DSC test.
- **Bounded persistence context during the GTFS seed.**
  `GtfsImportService` now flushes at section boundaries (between
  parent / platform stop passes, after `importStops`, after
  `importShapes`, after `importItineraries`). Eliminates the
  HHH90032022 "batch could not be sorted (might indicate a circular
  entity relationship)" warning that fired on every dev boot, without
  disabling `order_inserts` (which would have broken the scheduled
  re-import with FK violations).
- **Caffeine caches enable `recordStats()`** so Micrometer's
  `CaffeineCacheMetrics` binder gets the hit / miss / load counters
  it expected at startup.
- **`spring.jpa.open-in-view: false`** in the dev profile. Every
  controller path either reads through a JOIN-FETCH query or sits
  behind a service `@Transactional`, so OSIV was masking missing
  fetches with silent N+1 lazy loads at JSON-serialization time.
  Verified against the seeded Grenoble feed: every API endpoint
  exercising lazy collections still returns 200 with no
  `LazyInitializationException`.

### Fixed
- **Kiosk `formatRelativeTime` / `getMinutesUntil` flake.** Tests
  that captured `now` at file-load time and asserted on the relative
  minute count could straddle a minute boundary if execution started
  late. Pinned via `vi.useFakeTimers({ toFake: ['Date'] })` plus
  `vi.setSystemTime` in the affected describes; assertions now use
  hard-coded times against the frozen clock.
- **`GlobalExceptionHandler` no longer dumps 500 on client mistakes.**
  Three new handlers map predictable client-side errors to the
  appropriate 4xx code: `MissingServletRequestParameterException` →
  400 with the missing parameter name in the body,
  `MethodArgumentTypeMismatchException` → 400 (a malformed UUID in a
  path variable used to bubble up as 500), and
  `NoResourceFoundException` → 404 (typo'd path now looks like
  not-found instead of server bug). Surfaced while writing the
  TranslationController + DisplayController integration tests.

## [0.8.0] - 2026-05-07

GTFS Fares v2 lands alongside v1, the admin UI gains read-only
browsers for every previously-headless backend endpoint (realtime,
fares, TAD, translations, import history, pathways, shapes), and the
schedule import produces real per-departure rows from
`frequencies.txt` instead of a single annotated row.

### Added
- **GTFS Fares v2** (ADR 0021). Eight new tables persist the v2 model
  alongside v1: `areas`, `stop_areas`, `timeframes`, `fare_products`,
  `fare_leg_rules`, `fare_transfer_rules`, plus `networks` /
  `route_networks` and `fare_media` from the V31 follow-up. Coexists
  with v1 — feeds in transition publish both, both get persisted.
  V34 adds `fare_leg_join_rules.txt` — closing the v2 spec — as its
  own table with stop FKs (network references stay raw strings).
- **Schematic network-map enrichment** (Phase 1.3 follow-up). The
  map collapses parent_station + child platforms back into one
  logical node — fixing the duplicate-dots regression introduced by
  Phase 1.3's per-platform persistence. Parent stations gather the
  union of their children's line codes, transfers between platforms
  collapse to transfers between parents (intra-station transfers
  drop off as they're walking inside the same node). Each
  `NetworkStop` now carries `wheelchairBoarding` and `hasOnDemand`
  so the popup surfaces accessibility / TAD pills, and the
  schematic adds a dashed ring around on-request stops to flag
  booking-required service at a glance.
- **Per-arrival platform badge on the kiosk** (ADR 0022 follow-up).
  `ArrivalInfo.platformCode` carries the actual stop's platform_code
  through DisplayState; the kiosk renders a badge between the line
  code and the destination when the per-arrival platform differs
  from the stop's own (parent-station kiosks aggregating multiple
  quays). On regular per-platform kiosks the value is suppressed to
  avoid redundancy. Hub display now prefers the per-arrival platform
  over the stop-level one too.
- **Per-platform Stops** (V33, ADR 0022). The importer no longer
  collapses parent_station chains. Each GTFS platform persists as
  its own Stop with `parent_stop_id` pointing at its station, plus
  the station itself. Schedules anchor to the actual platform; a
  kiosk bound to a parent station aggregates schedules from every
  child platform via a new `findChildIds` repo + `IN`-based
  schedule query. Existing devices bound to a previously-collapsed
  parent keep their UUID and start aggregating their newly-created
  platforms automatically — no rebinding needed. The downstream
  importers (itineraries, schedules, transfers, pathways, areas)
  shed their `rootStopIdByGtfsId` parent-walk: a GTFS `stop_id`
  resolves directly to the persisted Stop now.
- **TAD booking link on schedules** (V32). Each `Schedule` now carries
  optional `pickupBookingRule` / `dropOffBookingRule` FKs from
  `stop_times.pickup_booking_rule_id` / `drop_off_booking_rule_id`,
  populated at import. Closes the previously-orphaned link between
  `booking_rules.txt` (Phase 5.3) and individual arrivals.
- **Kiosk booking CTA on TAD arrivals**. When an arrival's pickup is
  `ON_REQUEST_AGENCY` / `ON_REQUEST_DRIVER` and a booking rule is
  attached, the kiosk renders a prominent badge with the phone
  number and minimum prior notice ("≥ 30 min"). `ArrivalInfo.booking`
  surfaces the booking rule's phone, URL, info URL, message and
  prior-notice minutes; null on regular fixed-route trips.
  HubArrivalInfo carries the same field. Drop-off bookings stay
  internal — surfacing them to a passenger boarding the trip would
  confuse more than it helps.
- **Aggregate browse endpoint** `GET /api/admin/fares-v2` returns the
  entire v2 graph (areas, timeframes, products, leg rules, transfer
  rules) in a single round-trip.
- **Admin browser pages** for every previously-headless endpoint —
  `/admin/realtime` (alerts + vehicles), `/admin/gtfs-data` (Fares v1,
  Fares v2, TAD, Translations), `/admin/import-audit`,
  `/admin/pathways` (per-stop autocomplete), `/admin/shapes` (SVG
  polyline preview, no Leaflet dependency).
- **Frequency fan-out** at import (ADR 0020). `frequencies.txt`
  windows now expand into per-departure `Schedule` rows
  (`windowStart + (stopTime - tripStart)` for every trip start in
  `[start_time, end_time)` step `headway_secs`). Trips with multiple
  windows (peak / off-peak / late) emit per-window rows with the
  right headway each.
- **OpenAPI tags** on the eight remaining admin controllers (Lines,
  Stops, Itineraries, Schedules, Devices, Messages, Users,
  Dashboard). Swagger UI groups every route under an explicit
  `Administration — *` heading; no more "default" bucket.

### Changed
- `loadFrequencies` returns `Map<String, List<FrequencyWindow>>`
  (start, end, headway, exact_times) instead of collapsing to the
  smallest declared headway. Loaded windows feed the fan-out
  iterator in `importSchedules`.
- Schedule importer makes one extra streaming pass over
  `stop_times.txt` to anchor trip start times — restricted to trips
  with frequency windows, so feeds without `frequencies.txt` pay
  zero overhead.

## [0.7.0] - 2026-05-07

OpenAPI documentation reaches feature parity with the controller surface
— every admin route is now grouped under a tag — and `frequencies.txt`
finally drives actual departures, not just an "every X min" badge.

### Added
- **Frequency fan-out at import** (ADR 0020). High-frequency lines
  declared with `frequencies.txt` windows now persist one `Schedule`
  per generated departure (`windowStart + (stopTime - tripStart)` for
  every trip start in `[start_time, end_time)` step `headway_secs`)
  instead of a single annotated row per stop_time. The kiosk shows
  real upcoming times on metro / BRT lines, the hub display can
  aggregate frequency-mode arrivals, and the "every X min" badge
  keeps appearing because the headway annotation is preserved on
  every fan-out row. Trips with multiple windows (peak / off-peak /
  late) emit per-window rows with the right headway each.
- **OpenAPI tags** on the eight remaining admin controllers
  (Lines, Stops, Itineraries, Schedules, Devices, Messages, Users,
  Dashboard). Swagger UI groups every route under an explicit
  `Administration — *` heading; no more "default" bucket.

### Changed
- `loadFrequencies` returns `Map<String, List<FrequencyWindow>>`
  (start, end, headway, exact_times) instead of collapsing to the
  smallest declared headway. Loaded windows feed the fan-out
  iterator in `importSchedules`.
- Schedule importer makes one extra streaming pass over
  `stop_times.txt` to anchor trip start times — restricted to trips
  with frequency windows, so feeds without `frequencies.txt` pay
  zero overhead.

## [0.6.0] - 2026-05-07

The kiosk turns "live". GTFS-Realtime ServiceAlerts and TripUpdates
are polled from the agency's feed every 30 s, alerts overlay onto
the existing message ticker, and per-arrival delays surface as a
green / amber / red badge with the projected time. Static GTFS gets
its remaining major files persisted (location groups, booking rules,
fare attributes, shapes), and the import becomes idempotent —
re-imports preserve UUIDs so kiosks no longer unbind on the nightly
refresh. Architecture decisions captured in `docs/adr/0012..0018`.

### Added

#### GTFS-Realtime alerts (Phase 3 light)
- **`gtfs-realtime.proto` vendored** at
  `backend/src/main/proto/gtfs-realtime.proto`. The Gradle Protobuf
  plugin generates the Java bindings at build time — no system-wide
  `protoc` install required, no non-Maven-Central repos.
- **`RealtimeAlertCache`** holds the parsed snapshot atomically;
  `RealtimeAlertScheduler` polls the configured URL on
  `app.gtfs-rt.alerts-poll-cron` (default every 30 s) and on
  `ApplicationReadyEvent` so the first kiosk request after boot
  sees alerts immediately. See ADR 0017.
- **Display overlay** — alerts matching the stop / line / agency
  external_id append to the existing `MessageInfo` list with a
  GTFS-RT-derived severity (`SEVERE` → `CRITICAL`,
  `WARNING` → `WARNING`, otherwise inferred from `effect`).
- **`GET /api/admin/realtime/alerts`** + `POST .../refresh` for
  admin browse and on-demand re-poll.

#### GTFS-Realtime trip updates (Phase 3.2)
- **`RealtimeTripUpdateCache`** indexes per-trip / per-stop
  delay seconds (`Map<tripId, TripAdjustment>`), polled at the same
  cadence as alerts via `app.gtfs-rt.trip-updates-url`.
- **`ArrivalInfo.realtimeDelaySeconds`** — positive late, negative
  early, null when no update covers the arrival. Mirrored on
  `HubArrivalInfo`. The kiosk renders a "live" badge whenever it's
  non-null and projects the displayed time as
  `scheduledTime + delay` so passengers see both numbers when they
  matter. See ADR 0018.
- **SKIPPED stop_time_updates** drop the schedule entirely — the
  kiosk doesn't show a phantom departure with a delay badge.

#### Demand-responsive transit (Phase 5.3)
- **`LocationGroup` + `LocationGroupStop`** persist location
  bundles for flexible-route services.
- **`BookingRule` entity** captures the booking channel (phone /
  URL), advance-notice duration window, and prior-day cutoff.
- **`GET /api/admin/booking-rules`** sorts rules by booking type
  (real-time → same-day → prior-days). See ADR 0015.

### Changed
- **GTFS import is now idempotent** (Phase 0.5c) — `Agency` /
  `Line` / `Stop` / `Itinerary` upsert by `external_id` so
  `Device.stop_id` and `BroadcastMessage.scope_id` stay stable
  across re-imports. Stops that disappear from the feed are
  flagged `disabled = true` rather than deleted, preserving the FK
  for any kiosk still pointing at them. Re-enabled automatically
  if the stop reappears. See ADR 0013.
- **Schedules are wiped on every import** — required to keep them
  consistent with the wiped-and-rebuilt `service_calendars` table
  introduced in 0.4.0.
- **OpenAPI controllers tagged in French** (Phase 7b) — see
  ADR 0016 for the convention.

### Frontend
- **Kiosk renders the live badge** with projected time. Late
  arrivals (>60 s) get a red tint, early (<−60 s) amber, on-time a
  green pulse. The scheduled time remains in the payload so a
  future "scheduled / live" tooltip can compare both.

---

## [0.5.0] - 2026-05-07

Round of GTFS coverage hardening: imports now preserve UUIDs across
runs (so kiosks no longer unbind on the nightly refresh), Fares v1
and shapes are persisted, and operators get a Swagger-UI shortcut to
the API. Five new Flyway migrations (V24 already shipped in 0.4.0;
V25–V28 land here for pathways/levels, translations, fares,
shapes), all additive. Architecture decisions captured in
`docs/adr/0009..0014`.

### Added

#### Idempotent import (Phase 0.5c)
- **Upsert by `external_id`** for `Agency`, `Line`, `Stop`,
  `Itinerary`. Re-imports update the same rows in place rather than
  recreating them — UUIDs stay stable, `Device.stop_id` and
  `BroadcastMessage.scope_id` survive. See ADR 0013.
- **Stops dropped from the feed** are now flagged
  `disabled = true` instead of being deleted, so kiosks holding the
  FK don't lose their binding. Re-enabled automatically when the
  stop reappears.
- **Lines / Itineraries dropped** are hard-deleted (cascade clears
  their schedules / itinerary stops / stop_lines).
- **Schedules wiped on every import** (no `external_id`, no outside
  FK) — Phase 1.4's calendar refactor made this necessary so
  schedules with a nulled-out `service_calendar_id` don't become
  "always active" zombies.
- **`stop_lines` rebuilt** on every import so a line dropped from
  the feed actually disappears from `stop.getLines()`.

#### GTFS Fares v1 (Phase 4.1)
- **`FareAttribute` entity** persists `fare_attributes.txt`: price
  (`BigDecimal`, scale 4), currency (ISO-4217), payment method
  (`ON_BOARD` | `PREPAID`), transfer policy (`null` = unlimited
  per spec), optional agency FK.
- **`FareRule` entity** persists `fare_rules.txt` with optional
  route FK plus three free-form zone strings (`origin_id`,
  `destination_id`, `contains_id`). See ADR 0012.
- **`GET /api/admin/fares`** returns every fare attribute with its
  rules inline, sorted cheapest first.

#### GTFS shapes (Phase 2.1)
- **`Shape` + `ShapePoint` entities** persist `shapes.txt`. The
  `(shape_id, sequence)` pair is unique by spec; we enforce it at
  the schema level so a malformed feed surfaces immediately.
- **`Itinerary.shape`** FK (nullable) links to the representative
  trip's `shape_id`. Null = the feed didn't ship a shape for this
  trip. See ADR 0014.
- **`GET /api/itineraries/{id}/shape`** exposes the polyline as
  `[{lat, lon, distTraveled?}]`. Returns 204 (not 404) when the
  itinerary exists but has no shape, so a future map view falls
  back to stop-to-stop lines without distinguishing
  itinerary-not-found from feed-shipped-no-shape.

### Changed
- `GtfsImportService.TripInfo` now carries `shapeId` so the
  itinerary loop can wire the shape FK during the same upsert.
- `importItineraries()` clears `stop.getLines()` before rebuilding
  to honour the idempotent-import contract.
- `importSchedules()` now wipes the schedules table at the start
  (was implicit before — the boot loader's seed-once guard masked
  the issue).

---

## [0.4.0] - 2026-05-07

Second wave of GTFS integration: the kiosk now respects the day of
the week, surfaces indoor topology, supports localised feeds, and the
API gains a bundled Swagger UI. Three new Flyway migrations (V24–V26),
all additive except for `schedules`'s unique key swap to allow
multiple service calendars to share `(stop, itinerary, time)` triples.
Architecture decisions are captured in `docs/adr/0008..0011`.

### Added

#### Multi-day service calendars (Phase 1.4)
- **`ServiceCalendar` and `ServiceCalendarException` entities** mirror
  GTFS `calendar.txt` and `calendar_dates.txt`. Persisted instead of
  collapsed onto a single representative day as before.
- **`Schedule.service_calendar_id`** FK (nullable) ties each row to
  its calendar. Null = "always active" so admin-created and legacy
  rows keep showing every day. See ADR 0008.
- **`ServiceCalendarMatcher` domain util** decides whether a calendar
  is active on a given date — exception > validity range > weekly
  pattern, matching the GTFS resolution order.
- **`DisplayStateCalculator` filters arrivals by day**, with the
  cross-midnight tail evaluated against tomorrow's calendar.
- Unique key on `schedules` swapped from
  `(stop, itinerary, time)` to
  `(stop, itinerary, time, service_calendar_id)` so two services
  can share a triple as long as they run on different days.

#### Indoor topology (Phase 5.1)
- **`StationLevel` entity** persists `levels.txt` (level_index plus
  level_name) for every floor of a station.
- **`Pathway` entity** persists `pathways.txt` with the full GTFS
  payload: `pathway_mode` (`WALKWAY` / `STAIRS` / `MOVING_SIDEWALK` /
  `ESCALATOR` / `ELEVATOR` / `FARE_GATE` / `EXIT_GATE`), bidirectional
  flag, optional length / traversal time / stair count / max slope /
  min width / signpost text. See ADR 0009.
- **`GET /api/stops/{id}/pathways`** returns every pathway touching
  the stop, outgoing first, then sorted by mode and signpost text.

#### Translations (Phase 4.2)
- **`Translation` entity** persists `translations.txt` polymorphically
  (`table_name`, `record_id`, `field_value`, `field_name`, `language`,
  `translation`).
- **`TranslationLookup` domain util** loads the chosen language into
  an in-memory map keyed by `(table, record_id, field)` for O(1)
  resolution at render time.
- **`app.translations.preferred-language`** config (BCP-47 tag, empty
  by default) drives stop / line / destination translation across
  the kiosk and hub displays. Empty = no behaviour change. See
  ADR 0010.
- **`GET /api/admin/translations?lang=fr&table=stops`** lets admins
  audit which rows are localised before flipping the property.

#### API discoverability (Phase 7)
- **Springdoc OpenAPI** bundled at `/swagger-ui.html` and
  `/v3/api-docs`. Bearer-JWT security scheme declared so the
  "Authorize" button on Swagger UI takes a token from
  `POST /api/auth/login` and re-uses it on every "Try it out" call.
  See ADR 0011.

### Changed
- `GtfsImportService` now imports schedules for **every** active
  service rather than collapsing onto a single representative day,
  multiplying the schedule volume by the number of services in the
  feed (typically 3–10×). Postgres handles it without indexing
  changes; the kiosk SQL still returns ≤ 50 rows per stop per
  30-minute window before filtering.
- `GtfsImportService` adds top-level imports for `levels.txt`,
  `pathways.txt` and `translations.txt`.

---

## [0.3.0] - 2026-05-06

GTFS integration deepened across the model, the import pipeline and the
passenger-facing display. Eighteen Flyway migrations (V6–V23), all
additive except the `lines.code` widening from VARCHAR(10) to
VARCHAR(30). Architecture decisions are captured in `docs/adr/`.

### Added

#### Domain model
- **`LineType` extended** to ten values (`BUS`, `TRAM`, `METRO`, `TRAIN`,
  `FERRY`, `FUNICULAR`, `CABLE_CAR`, `TROLLEYBUS`, `MONORAIL`, `OTHER`)
  with a tier-based `route_type` mapping covering the basic GTFS modes
  (0..12) and the Extended Hierarchical Vehicle Types (100..1799). See
  ADR 0001.
- **`Agency` entity** populated from `agency.txt`. `Line.agency_id`
  becomes the per-line owner of timezone, language and contact info.
  `DisplayStateCalculator` resolves the display zone via Stop →
  Agency → `app.timezone` fallback. See ADR 0002.
- **`FeedInfo` singleton** captures `feed_info.txt` plus source URL,
  SHA-256 and import timestamp. Replaced in place at every successful
  import. See ADR 0003.
- **`ImportAudit` append-only log** records every attempt — successful,
  skipped or failed — with duration, entity counters, status and
  trigger identifier. See ADR 0003.
- **`Transfer` entity** persists `transfers.txt`. Inline on the
  network-map response so the route-finder weights interchanges by
  declared `min_transfer_time` instead of the previous magic constant.
  See ADR 0006.
- **`Attribution` entity** persists `attributions.txt` with role flags
  (producer / operator / authority). Public endpoint.
- **`external_id` columns** on `Stop`, `Line`, `Itinerary`, `Agency`,
  `Attribution` so re-imports can match rows rather than recreate them.
- **`stops.disabled`** soft-delete flag, ready for the matching
  algorithm landing in a follow-up.
- **Stop identity extended** with `short_code` (the signpost id),
  `tts_name` (screen-reader pronunciation), `stop_timezone`,
  `description`, `url`, `wheelchair_boarding`, `platform_code`.
- **Per-itinerary defaults** for `wheelchair_default` and
  `bikes_allowed_default`, computed via majority vote across the trips
  of the same `(route, direction)`. Per-schedule overrides stored
  only when a trip diverges. See ADR 0005.
- **`Schedule` enriched** with `pickup_type`, `drop_off_type`,
  `wheelchair_override`, `bikes_allowed_override`, `timepoint`,
  `frequency_headway_seconds`, `frequency_exact_times`, `block_id`.
  The headway annotation lets the kiosk render "every 4 min" alongside
  the next-departure clock for high-frequency lines.
- **`ItineraryStop.stop_headsign`** drives the destination shown to
  passengers, falling back to the trip-level terminus. See ADR 0004.
- **`Line` enriched** with `text_color` (route_text_color, with YIQ
  fallback for missing values), `continuous_pickup` /
  `continuous_drop_off`, `sort_order`, `description`, `url`. Code
  widened to VARCHAR(30).

#### Import pipeline
- **`GtfsImportOrchestrator`** — single entry point shared by the boot
  loader, the cron scheduler and the admin endpoint. Owns the
  `ReentrantLock`, the streaming SHA-256 and the audit-row lifecycle.
  See ADR 0007.
- **`GtfsRefreshScheduler`** — daily cron at 04:00 by default,
  configurable via `app.data-loader.gtfs.refresh-cron`.
- **Cache validation** in `GtfsDownloader` via `If-Modified-Since` and
  `If-None-Match`, with a sidecar `.meta` file holding the previous
  response's `Last-Modified` and `ETag`. 304 responses reuse the
  cached zip even past the local TTL.
- **Manual reimport endpoint** `POST /api/admin/gtfs/reimport` runs
  synchronously under the admin's identity.
- **Domain util `ColorContrast`** computes a WCAG-aligned foreground
  for any background color via the YIQ luminance formula. Used by the
  importer when `route_text_color` is missing and by `LineService` for
  admin-created lines.

#### API
- `GET /api/agencies` — agency list (any authenticated user).
- `GET /api/admin/feed-info` — current feed metadata (admin).
- `GET /api/admin/import-audit?limit=N` — recent import attempts (admin).
- `POST /api/admin/gtfs/reimport` — force a refresh (admin).
- `GET /api/attributions` — public credit block.
- `LineResponse` now carries `agencyId` / `agencyName` so the admin
  table can show the operating agency without a second request.
- `StopResponse` now carries `shortCode`, `platformCode`,
  `description`, `url`, `wheelchairBoarding` so the admin stop screen
  surfaces the full GTFS identity in one payload.

#### Frontend
- **Kiosk display** renders accessibility (`accessible_forward` /
  `do_not_disturb`), bicycle (`directions_bike`) and pickup-type
  badges next to each arrival, plus a discreet `stop_code` sub-title
  so passengers can confirm the signpost id printed at the stop.
- **Admin dashboard** gains a `FeedInfoCard` surfacing publisher,
  version, validity range and days-until-expiry (red expired, amber
  expiring within 7 days, default otherwise).
- **`lineTextColor` helper** prefers the server-resolved foreground
  before the YIQ fallback. Used by kiosk, hub display, schematic-map
  and admin dashboard line badges.
- **Route-finder** consumes the inline `transfers` from the
  network-map snapshot. Type 3 transfers (impossible) are pruned;
  type 1 (timed) drops to near-zero; types 0/2 use `min_transfer_time`
  with a 180s default.

### Changed
- `Line.code` column widens to `VARCHAR(30)` (was 10). The kiosk badge
  CSS already auto-shrinks for long codes.
- `app.timezone` becomes a fallback rather than the primary source.
  Existing installs without GTFS data behave identically.

### Fixed
- `route_type = 12` no longer mis-maps to `TRAM` (it's now `MONORAIL`).
- Ferries (`route_type = 4`, `1000-1299`), trolleybuses (11, 800-899),
  funiculars (7, 1400-1499) and aerial cable cars (6, 1300-1399) are
  no longer silently bucketed as `BUS`.

---

## [0.2.0] - 2026-05-06

### Fixed (correctness)

- **Heartbeat WebSocket** : added the missing `@MessageMapping("/device/heartbeat")` handler. Previously every kiosk device flipped to OFFLINE 2 minutes after authenticating because nothing on the backend was reading the heartbeat the front-end was sending.
- **Cross-day schedule lookup** : `DisplayStateCalculator` now issues a second query when the 30-minute window crosses midnight, so kiosks no longer go blank in the late evening.
- **Migration V3** : added the missing `lines.category` column the entity expected; `ddl-auto: validate` would have refused to boot in prod.
- **Hub partial failure** : a deleted/typo'd stop in the hub URL no longer takes down the entire screen — the others keep rendering.
- **Last admin guard** : the backend now refuses any delete/update that would leave zero active administrators (the front-end check alone was a comment claiming a server-side guarantee that didn't exist).

### Fixed (data integrity)

- **`LineService.deleteLine`** : itinerary stops are removed before bulk-deleting itineraries; the FK had no `ON DELETE CASCADE`.
- **`ItineraryService.addStopToItinerary`** : positions shifted via a single SQL bulk update so the `(itinerary_id, position)` unique constraint isn't violated mid-flush.
- **`ScheduleService`** : refuses schedules on empty itineraries or itineraries that don't actually serve the target stop (announcements that misled passengers).
- **`@Version` optimistic locking** added on Stop, Line, Itinerary, Schedule, BroadcastMessage and User. Concurrent admin edits now surface as 409 instead of silent last-writer-wins.
- **`StopDeletedEvent`** : kiosks subscribed to a deleted stop receive a final CRITICAL "stop removed" payload instead of freezing on stale data.

### Security

- **STOMP CONNECT validates the JWT** via a `ChannelInterceptor` and binds the principal to the session — anonymous connections still allowed for public kiosks but invalid tokens are now rejected.
- **NETWORK-scope messages require ROLE_ADMIN** at service-level (`assertAuthorizedForScope`); agents can no longer push network-wide alerts.
- **Logout disconnects all live WebSocket sessions** (display, hub, network-map) instead of leaving them subscribed for an account that no longer has a token.
- **Snapshot on reconnect** : every WS service emits `reconnected$`; consumers (kiosk, hub, network-map) re-fetch their REST snapshot after a disconnect to catch the deletes/renames the broker may have skipped.
- **JWT secret** moved out of `application.yml` (env var with a labelled dev fallback); prod still refuses to boot without `JWT_SECRET`.
- **`JwtAuthenticationFilter`** sets `WWW-Authenticate: Bearer error="invalid_token"` so the front can distinguish "session expired" from "no session".
- **30-second clock-skew leeway** on both the JWT parser and the front-end's `isTokenExpired` to avoid spurious 401s when client and server drift apart.
- **CORS allowed origins** now read from `app.cors.allowed-origins` env-driven CSV instead of localhost-only literals.

### Performance

- **N+1 elimination** on stop and message listings via `countByStopIdIn` and bulk `findAllById`.
- **V5 migration** : added `idx_stop_lines_line` and `idx_devices_stop` for the FKs that were forcing seq scans.
- **Targeted NETWORK fan-out** : `recalculateAndPushAll` intersects affected stops with active subscribers, no longer recalculating thousands of unwatched displays per network-wide message.
- **Aggregated dashboard endpoint** `/api/admin/dashboard` replaces the legacy `forkJoin` of five non-paginated GETs that downloaded the entire domain on every dashboard open.
- **`/topic/network-map` subscriber tracking** : `NetworkMapService` skips the recompute and broadcast when nobody is listening.
- **ETag / 304 Not Modified** on `/api/network-map`, `/api/lines`, `/api/stops`, `/api/itineraries`.
- **`pg_trgm` GIN indexes** (Postgres-only opt-in via `db/migration-postgres/`) for fast `LIKE '%term%'` admin search.

### Changed

- `BroadcastMessage.isActiveAt` is now half-open `[start, end)` to align with the SQL repository, removing the one-nanosecond hole between domain and DB.
- `app.timezone` (default `Europe/Paris`) drives `DisplayStateCalculator.LocalTime.now(zone)` so a JVM running in UTC no longer offsets every kiosk by an hour.
- `DisplayStateCalculator.versionMap` is purged when a stop is deleted (no more unbounded growth on long-lived processes).
- Frontend kiosk + hub ignore out-of-order WS pushes (incoming `version < current`).
- 401 race in the auth interceptor : a module-level `isLoggingOut` flag guards against N parallel 401s triggering N redirects.
- Self-hosted fonts (`@fontsource/inter`, `@fontsource/roboto`, `material-icons`) replace the Google Fonts CDN — privacy + offline resilience + faster initial paint.
- `JwtAuthenticationFilter` now uses `org.jspecify.annotations.NonNull` instead of the deprecated `org.springframework.lang.NonNull`.

---

## [0.1.0] - 2026-02-01

### Added

#### Backend
- Initialized Spring Boot 3.3.5 project with Java 21
- Domain entities: Line, Stop, TimedEntry, BroadcastMessage, Device, User
- JPA repositories for all entities
- Business services: LineService, StopService, ScheduleService, MessageService, DeviceService
- DisplayState service with real-time arrival calculation
- JWT authentication with JwtService and security filter
- STOMP WebSocket configuration for real-time updates
- Domain events to trigger display state recalculation
- REST controllers: Auth, Lines, Stops, Schedules, Messages, Devices, Display
- GlobalExceptionHandler for unified error handling
- DataLoader creating default admin and agent users
- H2 (development) and PostgreSQL (production) support

#### Frontend
- Initialized Angular 18 project with standalone components
- Tailwind CSS configuration for styling
- Authentication service with JWT management
- Guard and interceptor for route protection
- API services for all resources (Lines, Stops, Schedules, Messages, Devices, Display)
- WebSocket service with automatic reconnection
- Admin layout with sidebar navigation
- Dashboard with statistics and alerts
- Line management screen (CRUD)
- Stop management screen with line filtering
- Schedule management screen with day selection
- Broadcast message management screen with scope
- Device management screen with token display
- Kiosk component for real-time public display
- Angular Signals support for reactivity

#### Documentation
- Main project README
- Installation guide
- REST API documentation
- Developer guide
- Deployment guide
- User guide

#### BMad Artifacts
- PRD (Product Requirements Document)
- UX Design Specification
- Architecture Document
- 10 Epics with 37 Stories
- Implementation Readiness Report
- Sprint Status tracking

### Technical
- Gradle 9.3.1 for backend build
- Angular CLI for frontend build
- TypeScript strict mode
- Bean Validation (backend)
- Signals and computed for reactivity (frontend)

---

## Change Types

- `Added`: new features
- `Changed`: changes to existing features
- `Deprecated`: features soon to be removed
- `Removed`: removed features
- `Fixed`: bug fixes
- `Security`: vulnerability fixes
