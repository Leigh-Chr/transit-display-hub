# Guide Developpeur

## Architecture

### Vue d'ensemble

Transit Display Hub suit une architecture en couches
inspiree du Domain-Driven Design avec separation claire
des responsabilites.

```text
+---------------------------------------------------------+
|                    Frontend (Angular 21)                 |
+---------------------------------------------------------+
|  Features         |  Core Services   |  Shared          |
|  - Admin          |  - AuthService   |  - Models        |
|  - Display        |  - ApiServices   |  - Components    |
|  - Network Map    |  - WebSocket     |                  |
|  - Auth           |  - Theme         |  - Pipes         |
|                   |  - Breakpoints   |                  |
+-------------------+------------------+------------------+
                            |
                       HTTP / WS
                            |
+---------------------------------------------------------+
|                Backend (Spring Boot 4.0.2)              |
+---------------------------------------------------------+
|  API Layer             |  Application Layer             |
|  - REST Controllers    |  - Services metier             |
|  - Exception Advice    |  - DTOs (request/response)     |
|                        |  - Exceptions                  |
+------------------------+--------------------------------+
|  Domain Layer          |  Infrastructure Layer          |
|  - Entities (model/)   |  - Security (JWT)              |
|  - Enums               |  - WebSocket Config            |
|  - Events              |  - Persistence (Repositories)  |
|  - Domain Services     |  - Cache Config                |
|                        |  - Data Loader                 |
+------------------------+--------------------------------+
                            |
                     H2 / PostgreSQL
```

---

## Backend

### Structure des packages

```text
com.transit.hub/
+-- TransitDisplayHubApplication.java    # Point d'entree
+-- domain/
|   +-- model/                           # Entites JPA
|   |   +-- Line.java
|   |   +-- Stop.java
|   |   +-- Itinerary.java
|   |   +-- ItineraryStop.java
|   |   +-- Schedule.java
|   |   +-- BroadcastMessage.java
|   |   +-- Device.java
|   |   +-- User.java
|   |   +-- enums/
|   |       +-- LineType.java            # METRO, BUS, TRAM, TRAIN
|   |       +-- MessageSeverity.java     # INFO, WARNING, CRITICAL
|   |       +-- MessageScope.java        # NETWORK, LINE, STOP
|   |       +-- DeviceStatus.java        # ONLINE, OFFLINE
|   |       +-- UserRole.java            # ADMIN, AGENT
|   +-- event/                           # Evenements domaine
|   |   +-- ScheduleChangedEvent.java
|   |   +-- MessageChangedEvent.java
|   |   +-- NetworkChangedEvent.java
|   +-- service/
|       +-- DisplayStateCalculator.java  # Calcul de l'etat
+-- application/
|   +-- service/                         # Services metier
|   |   +-- AuthService.java
|   |   +-- LineService.java
|   |   +-- StopService.java
|   |   +-- ItineraryService.java
|   |   +-- ScheduleService.java
|   |   +-- MessageService.java
|   |   +-- DeviceService.java
|   |   +-- UserService.java
|   |   +-- DisplayStateService.java
|   |   +-- NetworkMapService.java
|   +-- dto/
|   |   +-- request/                     # DTOs d'entree
|   |   +-- response/                    # DTOs de sortie
|   +-- exception/                       # Exceptions metier
+-- infrastructure/
|   +-- security/
|   |   +-- JwtService.java
|   |   +-- JwtAuthenticationFilter.java
|   |   +-- SecurityConfig.java
|   +-- websocket/
|   |   +-- WebSocketConfig.java
|   |   +-- ActiveDisplayTracker.java
|   +-- persistence/                     # Repositories JPA
|   |   +-- LineRepository.java
|   |   +-- StopRepository.java
|   |   +-- ItineraryRepository.java
|   |   +-- ItineraryStopRepository.java
|   |   +-- ScheduleRepository.java
|   |   +-- BroadcastMessageRepository.java
|   |   +-- DeviceRepository.java
|   |   +-- UserRepository.java
|   +-- config/
|   |   +-- CacheConfig.java            # Configuration Caffeine
|   +-- DataLoader.java                 # Donnees initiales
+-- api/
    +-- rest/                            # REST Controllers
    |   +-- AuthController.java
    |   +-- LineController.java
    |   +-- StopController.java
    |   +-- ItineraryController.java
    |   +-- ScheduleController.java
    |   +-- MessageController.java
    |   +-- DeviceController.java
    |   +-- UserController.java
    |   +-- DisplayController.java
    |   +-- NetworkMapController.java
    +-- advice/
        +-- GlobalExceptionHandler.java  # Gestion des erreurs
```

### Entites

#### Relations

```text
Line (N) ---- (M) Stop         # ManyToMany via table stop_lines
Line (1) ---- (N) Itinerary
Itinerary (1) ---- (N) ItineraryStop ---- Stop
Stop (1) ---- (N) Schedule
Stop (1) ---- (N) Device
Schedule ---- Itinerary         # ManyToOne

BroadcastMessage -- scopeType -- NETWORK | LINE | STOP
```

#### Stop

Un arret peut appartenir a plusieurs lignes (ManyToMany).
Il possede des coordonnees GPS optionnelles et des
coordonnees schematiques pour la carte du reseau.

```java
@Entity
@Table(name = "stops")
public class Stop {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private String name;
    private Double latitude, longitude;
    private Double schematicX, schematicY;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "stop_lines",
        joinColumns = @JoinColumn(name = "stop_id"),
        inverseJoinColumns = @JoinColumn(name = "line_id"))
    private Set<Line> lines;

    @OneToMany(mappedBy = "stop", cascade = CascadeType.ALL)
    private List<Schedule> schedules;

    @OneToMany(mappedBy = "stop")
    private List<Device> devices;
}
```

#### Schedule

Un horaire lie une heure de depart a un arret et un
itineraire. L'itineraire determine la ligne et la
direction (terminus).

```java
@Entity
@Table(name = "schedules")
public class Schedule {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private LocalTime time;

    @ManyToOne(fetch = FetchType.LAZY)
    private Stop stop;

    @ManyToOne(fetch = FetchType.LAZY)
    private Itinerary itinerary;
}
```

### Services

Les services encapsulent la logique metier et publient
des evenements domaine.

```java
@Service
@RequiredArgsConstructor
public class LineService {
    private final LineRepository lineRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional
    public LineResponse createLine(CreateLineRequest request) {
        Line line = new Line();
        line.setCode(request.code());
        line.setName(request.name());
        line.setColor(request.color());
        line.setType(request.type());

        Line saved = lineRepository.save(line);
        eventPublisher.publishEvent(
            new NetworkChangedEvent(this)
        );

        return LineResponse.from(saved);
    }
}
```

### Evenements domaine

Les evenements declenchent le recalcul de l'etat
d'affichage (DisplayState) et sa diffusion via WebSocket.

```java
// Evenements publies par les services
public record NetworkChangedEvent(Object source) {}
public record ScheduleChangedEvent(Object source) {}
public record MessageChangedEvent(Object source) {}

// Ecoute et diffusion via DisplayStateService
@Component
@RequiredArgsConstructor
public class DisplayStateService {

    @EventListener
    public void onNetworkChanged(
            NetworkChangedEvent event) {
        recalculateAndPushAllStates();
    }
}
```

### Securite JWT

```java
@Component
public class JwtService {

    public String generateToken(User user) {
        return Jwts.builder()
            .subject(user.getUsername())
            .claim("role", user.getRole().name())
            .issuedAt(new Date())
            .expiration(new Date(
                System.currentTimeMillis() + expiration))
            .signWith(getSigningKey())
            .compact();
    }

    public boolean validateToken(String token) {
        try {
            Jwts.parser()
                .verifyWith(getSigningKey())
                .build()
                .parseSignedClaims(token);
            return true;
        } catch (JwtException e) {
            return false;
        }
    }
}
```

---

## Frontend

### Structure

```text
src/app/
+-- app.component.ts              # Composant racine
+-- app.config.ts                 # Configuration Angular
+-- app.routes.ts                 # Definition des routes
+-- core/
|   +-- auth/
|   |   +-- auth.service.ts       # Gestion authentification
|   |   +-- auth.guard.ts         # Protection des routes
|   |   +-- role.guard.ts         # Autorisation par role
|   |   +-- auth.interceptor.ts   # Ajout token JWT
|   +-- api/
|   |   +-- line.service.ts
|   |   +-- stop.service.ts
|   |   +-- itinerary.service.ts
|   |   +-- schedule.service.ts
|   |   +-- message.service.ts
|   |   +-- device.service.ts
|   |   +-- user.service.ts
|   |   +-- display.service.ts
|   +-- websocket/
|   |   +-- websocket.service.ts  # Client STOMP
|   +-- services/
|       +-- theme.service.ts      # Gestion du theme
|       +-- breakpoint.service.ts # Detection responsive
+-- shared/
|   +-- models/
|   |   +-- index.ts              # Interfaces TypeScript
|   +-- components/
|   |   +-- confirm-dialog/
|   |   +-- empty-state/
|   |   +-- search-input/
|   |   +-- skeleton/             # Composants de chargement
|   +-- pipes/
+-- features/
|   +-- auth/
|   |   +-- login/
|   +-- admin/
|   |   +-- dashboard/
|   |   +-- lines/
|   |   +-- stops/
|   |   +-- itineraries/
|   |   +-- schedules/
|   |   +-- messages/
|   |   +-- devices/
|   |   +-- users/
|   +-- display/
|   |   +-- kiosk/
|   +-- network-map/
|       +-- network-map.component.ts
|       +-- services/
|       +-- components/
|       |   +-- schematic-map/
|       |   +-- schematic-line/
|       |   +-- schematic-stop/
|       |   +-- stop-popup/
|       |   +-- route-search-bar/
|       +-- utils/
+-- layouts/
    +-- admin-layout/
    +-- display-layout/
```

### Routes

```typescript
// Routes principales
{ path: '', redirectTo: '/admin', pathMatch: 'full' },
{ path: 'login', loadComponent: () =>
    import('./features/auth/login/...') },
{ path: 'admin', canActivate: [authGuard],
  loadComponent: () => ...,
  children: [
    // ADMIN + AGENT
    { path: 'dashboard', loadComponent: () => ... },
    { path: 'messages', loadComponent: () => ... },
    // ADMIN only
    { path: 'lines',
      canActivate: [roleGuard],
      data: { requiredRole: 'ADMIN' } },
    { path: 'stops',
      canActivate: [roleGuard],
      data: { requiredRole: 'ADMIN' } },
    { path: 'itineraries',
      canActivate: [roleGuard],
      data: { requiredRole: 'ADMIN' } },
    { path: 'schedules',
      canActivate: [roleGuard],
      data: { requiredRole: 'ADMIN' } },
    { path: 'devices',
      canActivate: [roleGuard],
      data: { requiredRole: 'ADMIN' } },
    { path: 'users',
      canActivate: [roleGuard],
      data: { requiredRole: 'ADMIN' } },
  ]
},
// Public routes
{ path: 'map', loadComponent: () => ... },
{ path: 'display', loadComponent: () => ... },
{ path: 'display/:stopId',
  loadComponent: () => ... },
{ path: '**', loadComponent: () =>
    import('./features/not-found/...') },
```

### Configuration Angular

```typescript
// app.config.ts - Providers principaux
provideZonelessChangeDetection()
provideRouter(routes)
provideHttpClient(
  withInterceptors([authInterceptor])
)
```

### Services API

```typescript
@Injectable({ providedIn: 'root' })
export class LineService {
  private readonly baseUrl = '/api/lines';
  private readonly http = inject(HttpClient);

  getAll(): Observable<Line[]> {
    return this.http.get<Line[]>(this.baseUrl);
  }

  create(
    request: CreateLineRequest
  ): Observable<Line> {
    return this.http.post<Line>(
      this.baseUrl, request
    );
  }

  update(
    id: string,
    request: CreateLineRequest
  ): Observable<Line> {
    return this.http.put<Line>(
      `${this.baseUrl}/${id}`, request
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(
      `${this.baseUrl}/${id}`
    );
  }
}
```

### Composants standalone

Angular 21 utilise des composants standalone et la
syntaxe de controle de flux.

```typescript
@Component({
  selector: 'app-lines',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div>
      @for (line of lines(); track line.id) {
        <div>{{ line.name }}</div>
      }
    </div>
  `
})
export class LinesComponent {
  private readonly lineService =
    inject(LineService);
  lines = signal<Line[]>([]);

  ngOnInit(): void {
    this.lineService.getAll().subscribe(
      lines => this.lines.set(lines)
    );
  }
}
```

### Signals

Le projet utilise les Signals d'Angular pour la
reactivite.

```typescript
// Definir un signal
lines = signal<Line[]>([]);

// Mettre a jour
this.lines.set(newLines);

// Signal derive (computed)
lineCount = computed(() => this.lines().length);

// Lire la valeur
console.log(this.lines());
```

### WebSocket Service

```typescript
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client: Client | null = null;
  private connectionStateSignal =
    signal<ConnectionState>('DISCONNECTED');

  connectionState =
    this.connectionStateSignal.asReadonly();

  connect(
    stopId: string
  ): Observable<DisplayState> {
    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        this.connectionStateSignal.set(
          'CONNECTED'
        );
        this.subscribeToStop(stopId);
      }
    });

    this.client.activate();
    return this.displayStateSubject
      .asObservable();
  }
}
```

---

## Bonnes pratiques

### Backend (bonnes pratiques)

1. **Immutabilite des DTOs** : Utiliser des records Java

   ```java
   public record CreateLineRequest(
       @NotBlank String code,
       @NotBlank String name,
       @NotBlank
       @Pattern(regexp = "^#[0-9A-Fa-f]{6}$")
       String color,
       @NotNull LineType type
   ) {}
   ```

2. **Validation** : Utiliser Bean Validation

   ```java
   @PostMapping
   public ResponseEntity<LineResponse> create(
       @Valid @RequestBody
       CreateLineRequest request) {
       return ResponseEntity
           .status(HttpStatus.CREATED)
           .body(lineService.createLine(request));
   }
   ```

3. **Transactions** : Annoter les methodes de service

   ```java
   @Transactional
   public LineResponse updateLine(
       UUID id, CreateLineRequest request) {
       // ...
   }
   ```

4. **Imports explicites** : Ne jamais utiliser
   d'imports wildcard (`*`). Toujours lister
   les classes importees individuellement.

   ```java
   // Correct
   import jakarta.persistence.Entity;
   import jakarta.persistence.Id;
   import jakarta.persistence.Table;

   // Interdit
   import jakarta.persistence.*;
   ```

5. **Log guards** : Entourer les appels de log
   avec un guard de niveau

   ```java
   if (log.isInfoEnabled()) {
       log.info("Processing stop: {}",
           stop.getName());
   }
   ```

6. **Accolades obligatoires** : Toujours utiliser
   des accolades pour les blocs `if`, `else`,
   `for`, `while`, meme sur une seule ligne.

7. **Comparaisons de chaines** : Placer le
   litteral en premier pour eviter les NPE

   ```java
   // Correct
   if ("desc".equalsIgnoreCase(sortDir)) {}

   // Interdit
   if (sortDir.equalsIgnoreCase("desc")) {}
   ```

8. **Switch exhaustifs** : Toujours ajouter un
   `default` dans les switch statements.

### Frontend (bonnes pratiques)

1. **Lazy loading** : Charger les composants a la
   demande

   ```typescript
   {
     path: 'admin',
     loadComponent: () =>
       import('./layouts/admin-layout')
         .then(m => m.AdminLayoutComponent)
   }
   ```

2. **Gestion d'etat** : Utiliser les Signals

   ```typescript
   // Preferer les signals aux BehaviorSubject
   currentUser = signal<User | null>(null);
   ```

3. **Typage strict** : Definir les interfaces

   ```typescript
   export interface Line {
     id: string;
     code: string;
     name: string;
     color: string;
     type: LineType;
     stopCount: number;
     itineraryCount: number;
   }
   ```

---

## Tests

### Backend (tests)

```bash
# Executer tous les tests
cd backend
./gradlew test

# Tests avec rapport de couverture
./gradlew test jacocoTestReport
```

Tests unitaires et d'integration pour : services,
repositories, securite JWT, filtre d'authentification,
tracker de connexions.

### Frontend (tests)

```bash
cd frontend

# Tests unitaires (Vitest)
npm test

# Tests avec couverture
npm run test:coverage

# Tests e2e (Playwright)
npm run e2e
```

Tests de composants et services avec configuration
zoneless (`provideZonelessChangeDetection`).

---

## Debugging

### Backend (debugging)

1. **Logs** : Configurer le niveau de log

   ```yaml
   logging:
     level:
       com.transit.hub: DEBUG
       org.springframework.security: DEBUG
   ```

2. **Console H2** : <http://localhost:8080/h2-console>

3. **Actuator** : <http://localhost:8080/actuator/health>

### Frontend (debugging)

1. **Angular DevTools** : Extension Chrome/Firefox

2. **Console navigateur** : Verifier les erreurs reseau

3. **Source maps** : Activees par defaut en developpement
