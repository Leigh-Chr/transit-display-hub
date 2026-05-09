# Developer Guide

## Architecture

### Overview

Transit Display Hub follows a layered architecture
inspired by Domain-Driven Design with a clear separation
of concerns.

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
|  - REST Controllers    |  - Business services           |
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

### Package Structure

```text
com.transit.hub/
+-- TransitDisplayHubApplication.java    # Entry point
+-- domain/
|   +-- model/                           # JPA Entities
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
|   +-- event/                           # Domain events
|   |   +-- ScheduleChangedEvent.java
|   |   +-- MessageChangedEvent.java
|   |   +-- NetworkChangedEvent.java
|   +-- service/
|       +-- DisplayStateCalculator.java  # State calculation
+-- application/
|   +-- service/                         # Business services
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
|   |   +-- request/                     # Input DTOs
|   |   +-- response/                    # Output DTOs
|   +-- exception/                       # Business exceptions
+-- infrastructure/
|   +-- security/
|   |   +-- JwtService.java
|   |   +-- JwtAuthenticationFilter.java
|   |   +-- SecurityConfig.java
|   +-- websocket/
|   |   +-- WebSocketConfig.java
|   |   +-- ActiveDisplayTracker.java
|   +-- persistence/                     # JPA Repositories
|   |   +-- LineRepository.java
|   |   +-- StopRepository.java
|   |   +-- ItineraryRepository.java
|   |   +-- ItineraryStopRepository.java
|   |   +-- ScheduleRepository.java
|   |   +-- BroadcastMessageRepository.java
|   |   +-- DeviceRepository.java
|   |   +-- UserRepository.java
|   +-- config/
|   |   +-- CacheConfig.java            # Caffeine configuration
|   +-- DataLoader.java                 # Initial data
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
        +-- GlobalExceptionHandler.java  # Error handling
```

### Entities

#### Relationships

```text
Line (N) ---- (M) Stop         # ManyToMany via stop_lines table
Line (1) ---- (N) Itinerary
Itinerary (1) ---- (N) ItineraryStop ---- Stop
Stop (1) ---- (N) Schedule
Stop (1) ---- (N) Device
Schedule ---- Itinerary         # ManyToOne

BroadcastMessage -- scopeType -- NETWORK | LINE | STOP
```

#### Stop

A stop can belong to multiple lines (ManyToMany). It has
optional GPS coordinates and schematic coordinates for the
network map.

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

A schedule links a departure time to a stop and an
itinerary. The itinerary determines the line and direction
(terminus).

```java
@Entity
@Table(name = "schedules")
public class Schedule {
    @Id @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;
    private LocalTime time;            // arrival
    private LocalTime departureTime;   // distinct only when feed says so

    @ManyToOne(fetch = FetchType.LAZY)
    private Stop stop;

    @ManyToOne(fetch = FetchType.LAZY)
    private Itinerary itinerary;
}
```

#### FlexStopTime (GTFS-flex)

A `flex_stop_times` row stores the on-demand counterpart of
`stop_times.txt`: a service window (`start_pickup_drop_off_window`
to `end_pickup_drop_off_window`) over a polygon
(`location_id`) or a group of stops (`location_group_id`),
rather than a concrete arrival time at a fixed stop. The
spec makes the three target FKs (stop / location /
location_group) mutually exclusive; the importer enforces
that exactly one is set.

Kept separate from `schedules` because the consumers of the
two row types diverge — display calculator and kiosks read
`schedules`, while a TAD-aware booking surface reads
`flex_stop_times`. See ADR 0030.

```java
@Entity
@Table(name = "flex_stop_times")
public class FlexStopTime {
    @Id private UUID id;
    @ManyToOne private Itinerary itinerary;
    private Integer stopSequence;
    @ManyToOne private Stop stop;                  // exclusive
    @ManyToOne private Location location;          // exclusive
    @ManyToOne private LocationGroup locationGroup;// exclusive
    private LocalTime startPickupDropOffWindow;
    private LocalTime endPickupDropOffWindow;
    @ManyToOne private BookingRule pickupBookingRule;
    @ManyToOne private BookingRule dropOffBookingRule;
}
```

#### GTFS spec coverage matrix

The May 2026 audit closed every field gap between the
gtfs.org reference and the importer. The full coverage map
is in `CHANGELOG.md` under the "full GTFS-spec coverage
pass" section. Highlights of what's now persisted:

| File | Notable additions |
|---|---|
| `stops.txt` | `zone_id`, `stop_access` |
| `routes.txt` | `cemv_support` |
| `agency.txt` | `cemv_support` |
| `trips.txt` | `direction_id` (on Itinerary), `cars_allowed`, `safe_duration_factor`, `safe_duration_offset` |
| `stop_times.txt` | `departure_time` (distinct), `continuous_pickup/drop_off`, `shape_dist_traveled`, full GTFS-flex side via `flex_stop_times` |
| `transfers.txt` | `from_route_id` / `to_route_id` / `from_trip_id` / `to_trip_id` |
| `translations.txt` | `record_sub_id`, `language_context` |
| `fare_leg_join_rules.txt` | canonical `leg_group_id + leg_sequence + preceding_trip_transfer_limit` |
| `fare_transfer_rules.txt` | `minutes_before/after_to_start_boarding_time` |
| `fare_products.txt` | `rider_category_id` |
| `rider_categories.txt` | now imported (new entity) |
| `locations.geojson` | reads `properties.name` with `properties.stop_name` fallback |

The importer also warns when a feed reuses an id across the
`stops` / `locations` / `location_groups` namespace (the
spec mandates a single namespace).

### Services

Services encapsulate business logic and publish domain
events.

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

### Domain Events

Events trigger display state (DisplayState) recalculation
and broadcasting via WebSocket.

```java
// Events published by services
public record NetworkChangedEvent(Object source) {}
public record ScheduleChangedEvent(Object source) {}
public record MessageChangedEvent(Object source) {}

// Listening and broadcasting via DisplayStateService
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

### JWT Security

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
+-- app.component.ts              # Root component
+-- app.config.ts                 # Angular configuration
+-- app.routes.ts                 # Route definitions
+-- core/
|   +-- auth/
|   |   +-- auth.service.ts       # Authentication management
|   |   +-- auth.guard.ts         # Route protection
|   |   +-- role.guard.ts         # Role-based authorization
|   |   +-- auth.interceptor.ts   # JWT token injection
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
|   |   +-- websocket.service.ts  # STOMP client
|   +-- services/
|       +-- theme.service.ts      # Theme management
|       +-- breakpoint.service.ts # Responsive detection
+-- shared/
|   +-- models/
|   |   +-- index.ts              # TypeScript interfaces
|   +-- components/
|   |   +-- confirm-dialog/
|   |   +-- empty-state/
|   |   +-- search-input/
|   |   +-- skeleton/             # Loading components
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
|   |   +-- hub/
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
// Main routes
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
{ path: 'hub', loadComponent: () => ... },
{ path: 'display', loadComponent: () => ... },
{ path: 'display/:stopId',
  loadComponent: () => ... },
{ path: '**', loadComponent: () =>
    import('./features/not-found/...') },
```

### Angular Configuration

```typescript
// app.config.ts - Main providers
provideZonelessChangeDetection()
provideRouter(routes)
provideHttpClient(
  withInterceptors([authInterceptor])
)
```

### API Services

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

### Standalone Components

Angular 21 uses standalone components and the control
flow syntax.

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

The project uses Angular Signals for reactivity.

```typescript
// Define a signal
lines = signal<Line[]>([]);

// Update
this.lines.set(newLines);

// Computed signal
lineCount = computed(() => this.lines().length);

// Read the value
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

## Best Practices

### Backend (best practices)

1. **DTO immutability**: Use Java records

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

2. **Validation**: Use Bean Validation

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

3. **Transactions**: Annotate service methods

   ```java
   @Transactional
   public LineResponse updateLine(
       UUID id, CreateLineRequest request) {
       // ...
   }
   ```

4. **Explicit imports**: Never use wildcard imports
   (`*`). Always list imported classes individually.

   ```java
   // Correct
   import jakarta.persistence.Entity;
   import jakarta.persistence.Id;
   import jakarta.persistence.Table;

   // Forbidden
   import jakarta.persistence.*;
   ```

5. **Log guards**: Wrap log calls with a level guard

   ```java
   if (log.isInfoEnabled()) {
       log.info("Processing stop: {}",
           stop.getName());
   }
   ```

6. **Mandatory braces**: Always use braces for `if`,
   `else`, `for`, `while` blocks, even for single
   lines.

7. **String comparisons**: Place the literal first to
   avoid NPEs

   ```java
   // Correct
   if ("desc".equalsIgnoreCase(sortDir)) {}

   // Forbidden
   if (sortDir.equalsIgnoreCase("desc")) {}
   ```

8. **Exhaustive switches**: Always add a `default`
   case in switch statements.

### Frontend (best practices)

1. **Lazy loading**: Load components on demand

   ```typescript
   {
     path: 'admin',
     loadComponent: () =>
       import('./layouts/admin-layout')
         .then(m => m.AdminLayoutComponent)
   }
   ```

2. **State management**: Use Signals

   ```typescript
   // Prefer signals over BehaviorSubject
   currentUser = signal<User | null>(null);
   ```

3. **Strict typing**: Define interfaces

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
# Run all tests
cd backend
./gradlew test

# Tests with coverage report
./gradlew test jacocoTestReport
```

Unit and integration tests for: services, repositories,
JWT security, authentication filter, connection tracker.

### Frontend (tests)

```bash
cd frontend

# Unit tests (Vitest)
npm test

# Tests with coverage
npm run test:coverage

# E2E tests (Playwright)
npm run e2e
```

Component and service tests with zoneless configuration
(`provideZonelessChangeDetection`).

### Real-feed integration tests (opt-in)

Hits the public GTFS endpoints (Grenoble / Strasbourg /
Bordeaux) to validate the importer end-to-end. Excluded
from the default `test` task; run on demand:

```bash
./gradlew testRealFeed
```

Each test self-skips via JUnit Assumptions when the
upstream is unreachable, so the suite stays green on
flaky networks.

### JMH benchmarks

Pre-refactor confidence on hot paths. Two source sets,
one `jmh` task:

```bash
# Run every benchmark (5–10 min)
./gradlew jmh

# Filter to a single class / method
./gradlew jmh -Pjmh.includes='ServiceCalendarMatcher'
./gradlew jmh -Pjmh.includes='DisplayStateCalculatorIntegrationBenchmark'
```

Micro-benchmarks live at
`backend/src/jmh/java/com/transit/hub/bench/` —
`ServiceCalendarMatcher`, `TranslationLookup`,
`ColorContrast`. The full-stack benchmark sits under
`bench/integration/` and boots a real Spring Boot context
with H2 in-memory before measuring
`DisplayStateCalculator.calculateForStop`.

See ADR 0028 for the full rationale (no CI gating, single
fork by default for dev iteration speed).

---

## Observability

### Prometheus / Grafana

`/actuator/prometheus` is exposed publicly (same trust
posture as `/actuator/health`) and carries every default
Spring Boot meter (HTTP, JVM, Caffeine, datasource) plus
three custom meters around the GTFS import:

- `gtfs.import.duration` (Timer + histogram)
- `gtfs.import.completed{status=success|failed|skipped}`
- `gtfs.import.entities{kind=lines|stops|schedules}`

Every meter inherits the
`application="transit-display-hub"` tag so multi-deployment
Grafana instances can disambiguate without rewriting
queries.

A ready-to-import dashboard ships at
`ops/grafana/transit-display-hub.json` (HTTP / GTFS import /
Caffeine cache / JVM, four rows). Provisioning notes:
`ops/grafana/README.md`. See ADR 0027 for the design
trade-off (no in-house metrics layer, no JMX, no push).

---

## Debugging

### Backend (debugging)

1. **Logs**: Configure log level

   ```yaml
   logging:
     level:
       com.transit.hub: DEBUG
       org.springframework.security: DEBUG
   ```

2. **H2 Console**: <http://localhost:8080/h2-console>

3. **Actuator**: <http://localhost:8080/actuator/health>

### Frontend (debugging)

1. **Angular DevTools**: Chrome/Firefox extension

2. **Browser console**: Check for network errors

3. **Source maps**: Enabled by default in development
