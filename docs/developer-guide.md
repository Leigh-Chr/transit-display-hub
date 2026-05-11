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
|   |   +-- ...                         # 50+ entities total as of v1.2.0:
|   |                                   # GTFS-flex (FlexStopTime, Location,
|   |                                   # LocationGroup, BookingRule),
|   |                                   # Fares v2 (Area, Timeframe, FareProduct,
|   |                                   # FareLegRule, FareTransferRule,
|   |                                   # RiderCategory), Pathway, Shape,
|   |                                   # Translation, Attribution, etc.
|   |   +-- enums/                      # 10+ enums covering accessibility,
|   |                                   # transfer types, pickup/drop-off,
|   |                                   # occupancy, congestion levels…
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

### JWT + cookie-based session

Identity is carried on the wire by a HS256-signed JWT. Two transport
modes coexist (full rationale in
[ADR 0039](adr/0039-cookie-based-auth-with-refresh-tokens.md)):

- **Cookie session** for the browser SPA. `/api/auth/login` drops
  two `HttpOnly` cookies — `ACCESS_TOKEN` (path `/`) and
  `REFRESH_TOKEN` (path `/api/auth`) — and the same JWT in the JSON
  body for backwards compatibility. `/api/auth/refresh` rotates the
  refresh token (revokes the previous row, mints a successor,
  detects replay of an already-rotated value). `/api/auth/logout`
  revokes the refresh row server-side and clears both cookies.
  `/api/auth/me` rebuilds identity from the `SecurityContext` so the
  SPA can resume after a reload.
- **Bearer header** for Swagger UI, CLI consumers and STOMP CONNECT
  frames. `JwtAuthenticationFilter` reads `Authorization: Bearer …`
  first and falls back to the `ACCESS_TOKEN` cookie when the header
  is absent.

`@ConfigurationProperties` records (`JwtProperties`,
`AuthProperties`) centralise the configuration surface — the
`@NotBlank` constraint on `app.jwt.secret` makes the boot crash
loudly when the secret is missing.

```java
@Service
@RequiredArgsConstructor
public class JwtService {

    private final JwtProperties props;

    public String generateToken(User user) {
        Instant now = Instant.now();
        return Jwts.builder()
            .subject(user.getUsername())
            .issuer(props.issuer())
            .audience().add(props.audience()).and()
            .claim("role", user.getRole().name())
            .issuedAt(Date.from(now))
            .expiration(Date.from(
                now.plus(props.expirationHours(), ChronoUnit.HOURS)))
            .signWith(getSigningKey())
            .compact();
    }
}
```

`RefreshTokenService` stores only the SHA-256 digest of each issued
refresh token in the `refresh_tokens` table (migration V50) and
walks the `replaced_by_id` chain on every rotation — replay of a
token that already minted a successor is interpreted as theft and
revokes every active row for that user.

CSRF is **enabled** with `CookieCsrfTokenRepository.withHttpOnlyFalse()`
so Angular can mirror the `XSRF-TOKEN` cookie into the
`X-XSRF-TOKEN` header. A custom `RequestMatcher` exempts Bearer
callers (no browser auto-attach) and the `/api/auth/**` endpoints
(login has no XSRF cookie yet; refresh + logout are gated by their
own refresh-token cookie).

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
|   |   +-- auth.service.ts       # /me hydration + login/logout/refresh
|   |   +-- auth.guard.ts         # Route protection
|   |   +-- role.guard.ts         # Role-based authorization
|   |   +-- auth.interceptor.ts   # withCredentials + 401 → /refresh retry
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
|   +-- i18n/
|   |   +-- transloco.providers.ts # Transloco wiring
|   |   +-- transloco.loader.ts    # /assets/i18n/{lang}.json loader
|   |   +-- locale.service.ts      # Active language signal
|   +-- services/
|       +-- theme.service.ts      # Theme + a11y signals (dark / contrast / large-text)
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
|       +-- network-list/         # Tabular alternative (a11y)
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
```

```text
src/assets/i18n/
+-- fr.json                       # French dictionary (default)
+-- en.json                       # English dictionary
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
    // Native WebSocket since v1.0.x cleanup (sockjs-client removed).
    // brokerURL is derived from window.location so the same code runs
    // behind any reverse-proxy without environment-specific config.
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    this.client = new Client({
      brokerURL: `${wsProtocol}//${window.location.host}/ws`,
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

# Unit tests (Vitest, watch mode)
npm test

# One-shot run with V8 coverage report under coverage/
npm run test:coverage

# Smoke E2E (Playwright Chromium, requires backend + frontend up)
npm run e2e
```

Component and service tests with zoneless configuration
(`provideZonelessChangeDetection`). Coverage uses
`@vitest/coverage-v8` (V8 provider, MIT). Smoke E2E lives
in `frontend/e2e/` — three Chromium scenarios covering
`/map`, `/map/list` and `/login`. ADR 0037 documents the
quality-gate strategy and the rationale for not running
E2E in the pre-push hook.

### Continuous integration

Two GitHub Actions workflows under `.github/workflows/`,
gated on path filters so a doc-only commit doesn't burn
minutes:

- `backend.yml`: JDK 21 (temurin), gradle cache, runs
  `./gradlew test jacocoTestReport`, uploads JaCoCo HTML
  as a 7-day artifact.
- `frontend.yml`: Node 20, `npm ci`, lint + knip +
  `test:coverage` + `ng build --configuration production`,
  uploads coverage as artifact.

Only official `actions/*` actions used.

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

### Offline rich fixture (every spec surface)

Public feeds vary in what they ship — Grenoble for
example doesn't expose pathways, fares-v2 or
translations. To exercise every importer code path
without depending on a network, point the data-loader at
the in-classpath fixture:

```bash
DATA_LOADER_GTFS_URL=classpath:fixtures/gtfs-rich/ \
DATA_LOADER_GTFS_NETWORK_NAME="Rich Demo" \
./gradlew bootRun
```

`GtfsDownloader` recognises `classpath:` URLs and zips
the sub-directory at runtime, so the fixture travels with
the jar. The bundled `gtfs-rich/` covers pathways +
levels, fares V1 + V2, GTFS-flex (location + group +
stop targets), translations, transfer route qualifiers,
attributions, networks, timeframes, rider categories
and fare media. Used by the deferred-backlog wrap-up
validation pass to confirm every popup section, every
admin page and every metric end-to-end.

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
`ColorContrast`, plus the three
service-layer benches added during the deferred-backlog
wrap-up: `FareCalculatorServiceBenchmark`,
`FlexAvailabilityServiceBenchmark`,
`PathwayServiceBenchmark` (Mockito-stubbed repositories
to isolate service-side cost from the JPA round-trip).
The full-stack benchmark sits under
`bench/integration/` and boots a real Spring Boot context
with H2 in-memory before measuring
`DisplayStateCalculator.calculateForStop`.

See ADR 0028 for the full rationale (no CI gating, single
fork by default for dev iteration speed).

---

## Internationalisation (i18n)

Runtime language switching via Transloco
(`@jsverse/transloco`, MIT). Two languages shipped:
French (default) and English.

### Architecture

- `core/i18n/transloco.providers.ts` declares the
  available languages and the loader. `provideAppTransloco()`
  is plugged into `app.config.ts`.
- `core/i18n/transloco.loader.ts` fetches
  `/assets/i18n/{lang}.json` once per language per session.
- `core/i18n/locale.service.ts` wraps `TranslocoService`
  behind a signal API (`current()`, `setLang()`, `toggle()`).
  Eagerly instantiated at boot via `provideAppInitializer`
  so the language resolved from `localStorage` /
  `navigator.language` is applied before any component
  renders.
- `assets/i18n/fr.json` and `assets/i18n/en.json` are
  organised in four namespaces: `common`, `kiosk`, `map`,
  `admin`. Adding a new language = drop a `<code>.json`
  in the same folder and add the code to
  `TRANSLOCO_AVAILABLE_LANGS`.

### Adding a new translation key

1. Add the key in `fr.json` and `en.json` (same path).
2. Reference it in the template:
   `{{ 'namespace.key' | transloco }}` for an interpolated
   value or `*transloco="let t"` + `{{ t('namespace.key') }}`
   for multiple keys in the same template fragment.
3. For service code:
   `inject(TranslocoService).translate('namespace.key')`.

### Testing components that use Transloco

The pipe needs a Transloco provider in the test bed:

```typescript
imports: [
  YourComponent,
  TranslocoTestingModule.forRoot({
    langs: { en: {}, fr: {} },
    translocoConfig: { availableLangs: ['en', 'fr'], defaultLang: 'fr' },
  }),
]
```

See `network-map.component.spec.ts` for a worked example
that combines the testing module with `overrideComponent`
to mock child components.

ADR 0036 records the choice (Transloco vs.
`@angular/localize`).

---

## Accessibility (WCAG 2.2 AA)

Three orthogonal accessibility signals on `ThemeService`,
each persisted to localStorage independently:

- `isDarkMode` — light / dark palette.
- `isHighContrast` — WCAG-AAA black/yellow palette
  overriding M3 surface tokens. Defaults to
  `prefers-contrast: more`.
- `isLargeText` — boosts every M3 typescale variable by
  ~1.4×.

Applied via classes on `document.documentElement`
(`.dark-theme`, `.high-contrast-theme`,
`.large-text-theme`). Style overrides live in the global
`styles.scss`, so any route hosting the toggles inherits
the look.

Kiosk surface (`features/display/kiosk/`):

- 3-button toolbar in the header (high contrast / large
  text / vocal next-departure).
- `aria-pressed` reflects the toggle state, 44×44 px hit
  zones, French aria-labels translated through Transloco.
- Vocal announcement uses
  `window.speechSynthesis` directly — French locale,
  rate 0.95, cancels any in-flight utterance before
  speaking.

Admin and map surfaces:

- Admin layout ships a skip-link to `#main-content`,
  ESLint enforces `template/click-events-have-key-events`,
  Material 21 wires `cdkTrapFocus` on every `MatDialog`
  by default.
- Network map exposes a tabular alternative at
  `/map/list` for keyboard / screen reader users — same
  data, no SVG.

ADR 0035 records the design decisions.

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
