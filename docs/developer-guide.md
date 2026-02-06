# Guide Développeur

## Architecture

### Vue d'ensemble

Transit Display Hub suit une architecture en couches inspirée du Domain-Driven Design avec séparation claire des responsabilités.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Angular 21)                  │
├─────────────────────────────────────────────────────────┤
│  Features         │  Core Services   │  Shared           │
│  - Admin          │  - AuthService   │  - Models         │
│  - Display        │  - ApiServices   │  - Components     │
│  - Network Map    │  - WebSocket     │  - Animations     │
│  - Auth           │  - Theme         │  - Pipes          │
│                   │  - Breakpoints   │                   │
└───────────────────┴──────────────────┴───────────────────┘
                            │
                       HTTP / WS
                            │
┌─────────────────────────────────────────────────────────┐
│                Backend (Spring Boot 4.0.2)                │
├─────────────────────────────────────────────────────────┤
│  API Layer             │  Application Layer              │
│  - REST Controllers    │  - Services métier              │
│  - Exception Advice    │  - DTOs (request/response)      │
│                        │  - Exceptions                   │
├────────────────────────┴────────────────────────────────┤
│  Domain Layer          │  Infrastructure Layer           │
│  - Entities (model/)   │  - Security (JWT)               │
│  - Enums               │  - WebSocket Config             │
│  - Events              │  - Persistence (Repositories)   │
│  - Domain Services     │  - Cache Config                 │
│                        │  - Data Loader                  │
└────────────────────────┴────────────────────────────────┘
                            │
                     H2 / PostgreSQL
```

---

## Backend

### Structure des packages

```
com.transit.hub/
├── TransitDisplayHubApplication.java    # Point d'entrée
├── domain/
│   ├── model/                           # Entités JPA
│   │   ├── Line.java
│   │   ├── Stop.java
│   │   ├── Itinerary.java
│   │   ├── ItineraryStop.java
│   │   ├── Schedule.java
│   │   ├── BroadcastMessage.java
│   │   ├── Device.java
│   │   ├── User.java
│   │   └── enums/
│   │       ├── LineType.java            # METRO, BUS, TRAM, TRAIN
│   │       ├── MessageSeverity.java     # INFO, WARNING, CRITICAL
│   │       ├── MessageScope.java        # NETWORK, LINE, STOP
│   │       ├── DeviceStatus.java        # ONLINE, OFFLINE
│   │       └── UserRole.java            # ADMIN, AGENT
│   ├── event/                           # Événements domaine
│   │   ├── ScheduleChangedEvent.java
│   │   ├── MessageChangedEvent.java
│   │   └── NetworkChangedEvent.java
│   └── service/
│       └── DisplayStateCalculator.java  # Calcul de l'état d'affichage
├── application/
│   ├── service/                         # Services métier
│   │   ├── AuthService.java
│   │   ├── LineService.java
│   │   ├── StopService.java
│   │   ├── ItineraryService.java
│   │   ├── ScheduleServiceV2.java
│   │   ├── MessageService.java
│   │   ├── DeviceService.java
│   │   ├── UserService.java
│   │   ├── DisplayStateService.java
│   │   └── NetworkMapService.java
│   ├── dto/
│   │   ├── request/                     # DTOs d'entrée (records avec validation)
│   │   └── response/                    # DTOs de sortie (records)
│   └── exception/                       # Exceptions métier
├── infrastructure/
│   ├── security/
│   │   ├── JwtService.java
│   │   ├── JwtAuthenticationFilter.java
│   │   └── SecurityConfig.java
│   ├── websocket/
│   │   ├── WebSocketConfig.java
│   │   └── ActiveDisplayTracker.java
│   ├── persistence/                     # Repositories JPA
│   │   ├── LineRepository.java
│   │   ├── StopRepository.java
│   │   ├── ItineraryRepository.java
│   │   ├── ItineraryStopRepository.java
│   │   ├── ScheduleRepository.java
│   │   ├── BroadcastMessageRepository.java
│   │   ├── DeviceRepository.java
│   │   └── UserRepository.java
│   ├── config/
│   │   └── CacheConfig.java            # Configuration Caffeine
│   └── DataLoader.java                 # Données initiales (utilisateurs)
└── api/
    ├── rest/                            # REST Controllers
    │   ├── AuthController.java
    │   ├── LineController.java
    │   ├── StopController.java
    │   ├── ItineraryController.java
    │   ├── ScheduleControllerV2.java
    │   ├── MessageController.java
    │   ├── DeviceController.java
    │   ├── UserController.java
    │   ├── DisplayController.java
    │   └── NetworkMapController.java
    └── advice/
        └── GlobalExceptionHandler.java  # Gestion centralisée des erreurs
```

### Entités

#### Relations

```
Line (N) ──── (M) Stop         # ManyToMany via table stop_lines
Line (1) ──── (N) Itinerary
Itinerary (1) ──── (N) ItineraryStop ──── Stop
Stop (1) ──── (N) Schedule
Stop (1) ──── (N) Device
Schedule ──── Itinerary         # ManyToOne

BroadcastMessage ── scopeType ── NETWORK | LINE (scopeId=lineId) | STOP (scopeId=stopId)
```

#### Stop

Un arrêt peut appartenir à plusieurs lignes (ManyToMany). Il possède des coordonnées GPS optionnelles et des coordonnées schématiques pour la carte du réseau.

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

Un horaire lie une heure de départ à un arrêt et un itinéraire. L'itinéraire détermine la ligne et la direction (terminus).

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

Les services encapsulent la logique métier et publient des événements domaine.

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
        eventPublisher.publishEvent(new NetworkChangedEvent(this));

        return LineResponse.from(saved);
    }
}
```

### Événements domaine

Les événements déclenchent le recalcul de l'état d'affichage (DisplayState) et sa diffusion via WebSocket.

```java
// Événements publiés par les services
public record NetworkChangedEvent(Object source) {}
public record ScheduleChangedEvent(Object source) {}
public record MessageChangedEvent(Object source) {}

// Écoute et diffusion via DisplayStateService
@Component
@RequiredArgsConstructor
public class DisplayStateService {

    @EventListener
    public void onNetworkChanged(NetworkChangedEvent event) {
        recalculateAndPushAllStates();
    }
}
```

### Sécurité JWT

```java
@Component
public class JwtService {

    public String generateToken(User user) {
        return Jwts.builder()
            .subject(user.getUsername())
            .claim("role", user.getRole().name())
            .issuedAt(new Date())
            .expiration(new Date(System.currentTimeMillis() + expiration))
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

```
src/app/
├── app.component.ts              # Composant racine
├── app.config.ts                 # Configuration Angular (providers)
├── app.routes.ts                 # Définition des routes
├── core/
│   ├── auth/
│   │   ├── auth.service.ts       # Gestion authentification (Signals)
│   │   ├── auth.guard.ts         # Protection des routes
│   │   └── auth.interceptor.ts   # Ajout token JWT aux requêtes
│   ├── api/
│   │   ├── line.service.ts
│   │   ├── stop.service.ts
│   │   ├── itinerary.service.ts
│   │   ├── schedule.service.ts
│   │   ├── message.service.ts
│   │   ├── device.service.ts
│   │   ├── user.service.ts
│   │   └── display.service.ts
│   ├── websocket/
│   │   └── websocket.service.ts  # Client STOMP
│   └── services/
│       ├── theme.service.ts      # Gestion du thème
│       └── breakpoint.service.ts # Détection responsive
├── shared/
│   ├── models/
│   │   └── index.ts              # Interfaces et types TypeScript
│   ├── components/
│   │   ├── confirm-dialog/
│   │   ├── empty-state/
│   │   ├── search-input/
│   │   └── skeleton/             # Composants de chargement
│   ├── pipes/
│   └── animations/
│       ├── fade.animation.ts
│       ├── route.animation.ts
│       └── stagger.animation.ts
├── features/
│   ├── auth/
│   │   └── login/
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── lines/
│   │   ├── stops/
│   │   ├── itineraries/
│   │   ├── schedules/
│   │   ├── messages/
│   │   ├── devices/
│   │   └── users/
│   ├── display/
│   │   └── kiosk/
│   └── network-map/
│       ├── network-map.component.ts
│       ├── services/
│       ├── components/
│       │   ├── schematic-map/
│       │   ├── schematic-line/
│       │   ├── schematic-stop/
│       │   ├── stop-popup/
│       │   └── route-search-bar/
│       └── utils/
└── layouts/
    ├── admin-layout/
    └── display-layout/
```

### Routes

```typescript
// Routes principales
{ path: '', redirectTo: '/admin', pathMatch: 'full' },
{ path: 'login', loadComponent: () => import('./features/auth/login/...') },
{ path: 'admin', canActivate: [authGuard], loadComponent: () => ...,
  children: [
    { path: 'dashboard', loadComponent: () => ... },
    { path: 'lines', loadComponent: () => ... },
    { path: 'stops', loadComponent: () => ... },
    { path: 'itineraries', loadComponent: () => ... },
    { path: 'schedules', loadComponent: () => ... },
    { path: 'messages', loadComponent: () => ... },
    { path: 'devices', loadComponent: () => ... },
    { path: 'users', loadComponent: () => ... },
  ]
},
{ path: 'map', loadComponent: () => ... },      // Carte réseau (public)
{ path: 'display', loadComponent: () => ... },   // Kiosque (public)
{ path: 'display/:stopId', loadComponent: () => ... },
```

### Configuration Angular

```typescript
// app.config.ts - Providers principaux
provideZonelessChangeDetection()    // Détection de changements sans Zone.js
provideRouter(routes)
provideHttpClient(withInterceptors([authInterceptor]))
provideAnimations()
```

### Services API

```typescript
@Injectable({ providedIn: 'root' })
export class LineService {
  private readonly baseUrl = '/api/lines';

  constructor(private http: HttpClient) {}

  getAll(): Observable<Line[]> {
    return this.http.get<Line[]>(this.baseUrl);
  }

  create(request: CreateLineRequest): Observable<Line> {
    return this.http.post<Line>(this.baseUrl, request);
  }

  update(id: string, request: CreateLineRequest): Observable<Line> {
    return this.http.put<Line>(`${this.baseUrl}/${id}`, request);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
```

### Composants standalone

Angular 21 utilise des composants standalone et la syntaxe de contrôle de flux.

```typescript
@Component({
  selector: 'app-lines',
  standalone: true,
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
  lines = signal<Line[]>([]);

  constructor(private lineService: LineService) {}

  ngOnInit() {
    this.lineService.getAll().subscribe(lines =>
      this.lines.set(lines)
    );
  }
}
```

### Signals

Le projet utilise les Signals d'Angular pour la réactivité.

```typescript
// Définir un signal
lines = signal<Line[]>([]);

// Mettre à jour
this.lines.set(newLines);

// Signal dérivé (computed)
lineCount = computed(() => this.lines().length);

// Lire la valeur
console.log(this.lines());
```

### WebSocket Service

```typescript
@Injectable({ providedIn: 'root' })
export class WebSocketService {
  private client: Client | null = null;
  private connectionStateSignal = signal<ConnectionState>('DISCONNECTED');

  connectionState = this.connectionStateSignal.asReadonly();

  connect(stopId: string): Observable<DisplayState> {
    this.client = new Client({
      webSocketFactory: () => new SockJS('/ws'),
      reconnectDelay: 5000,
      onConnect: () => {
        this.connectionStateSignal.set('CONNECTED');
        this.subscribeToStop(stopId);
      }
    });

    this.client.activate();
    return this.displayStateSubject.asObservable();
  }
}
```

---

## Bonnes pratiques

### Backend

1. **Immutabilité des DTOs** : Utiliser des records Java
   ```java
   public record CreateLineRequest(
       @NotBlank String code,
       @NotBlank String name,
       @NotBlank @Pattern(regexp = "^#[0-9A-Fa-f]{6}$") String color,
       LineType type
   ) {}
   ```

2. **Validation** : Utiliser Bean Validation
   ```java
   @PostMapping
   public ResponseEntity<LineResponse> create(@Valid @RequestBody CreateLineRequest request) {
       return ResponseEntity.status(HttpStatus.CREATED).body(lineService.createLine(request));
   }
   ```

3. **Transactions** : Annoter les méthodes de service
   ```java
   @Transactional
   public LineResponse updateLine(UUID id, CreateLineRequest request) {
       // ...
   }
   ```

### Frontend

1. **Lazy loading** : Charger les composants à la demande
   ```typescript
   {
     path: 'admin',
     loadComponent: () => import('./layouts/admin-layout')
       .then(m => m.AdminLayoutComponent)
   }
   ```

2. **Gestion d'état** : Utiliser les Signals
   ```typescript
   // Préférer les signals aux BehaviorSubject
   currentUser = signal<User | null>(null);
   ```

3. **Typage strict** : Définir les interfaces
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

### Backend

```bash
# Exécuter tous les tests
cd backend
./gradlew test

# Tests avec rapport de couverture
./gradlew test jacocoTestReport
```

Tests unitaires et d'intégration pour : services, repositories, sécurité JWT, filtre d'authentification, tracker de connexions.

### Frontend

```bash
cd frontend

# Tests unitaires (Vitest)
npm test

# Tests avec couverture
npm run test:coverage

# Tests e2e (Playwright)
npm run e2e
```

Tests de composants et services avec configuration zoneless (`provideZonelessChangeDetection`).

---

## Debugging

### Backend

1. **Logs** : Configurer le niveau de log
   ```yaml
   logging:
     level:
       com.transit.hub: DEBUG
       org.springframework.security: DEBUG
   ```

2. **Console H2** : http://localhost:8080/h2-console

3. **Actuator** : http://localhost:8080/actuator/health

### Frontend

1. **Angular DevTools** : Extension Chrome/Firefox

2. **Console navigateur** : Vérifier les erreurs réseau

3. **Source maps** : Activées par défaut en développement
