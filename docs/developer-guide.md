# Guide Développeur

## Architecture

### Vue d'ensemble

Transit Display Hub suit une architecture en couches avec séparation claire des responsabilités.

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (Angular)                    │
├─────────────────────────────────────────────────────────┤
│  Features      │  Core Services   │  Shared Models      │
│  - Admin       │  - AuthService   │  - Interfaces       │
│  - Display     │  - ApiServices   │  - Types            │
│                │  - WebSocket     │                     │
└────────────────┴──────────────────┴─────────────────────┘
                            │
                       HTTP / WS
                            │
┌─────────────────────────────────────────────────────────┐
│                   Backend (Spring Boot)                  │
├─────────────────────────────────────────────────────────┤
│  API Layer          │  Application Layer                │
│  - Controllers      │  - Services                       │
│  - DTOs            │  - Domain Events                   │
├─────────────────────┴───────────────────────────────────┤
│  Domain Layer       │  Infrastructure Layer             │
│  - Entities        │  - Security (JWT)                  │
│  - Enums           │  - WebSocket Config                │
│  - Events          │  - Data Loader                     │
├─────────────────────┴───────────────────────────────────┤
│                   Persistence (JPA)                      │
│  - Repositories                                         │
└─────────────────────────────────────────────────────────┘
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
│   ├── entity/                          # Entités JPA
│   │   ├── Line.java
│   │   ├── Stop.java
│   │   ├── TimedEntry.java
│   │   ├── BroadcastMessage.java
│   │   ├── Device.java
│   │   └── User.java
│   ├── enums/                           # Énumérations
│   │   ├── MessageSeverity.java
│   │   ├── MessageScope.java
│   │   ├── DeviceStatus.java
│   │   └── UserRole.java
│   └── event/                           # Événements domaine
│       ├── ScheduleChangedEvent.java
│       ├── MessageChangedEvent.java
│       └── NetworkChangedEvent.java
├── application/
│   ├── service/                         # Services métier
│   │   ├── LineService.java
│   │   ├── StopService.java
│   │   ├── ScheduleService.java
│   │   ├── MessageService.java
│   │   ├── DeviceService.java
│   │   ├── DisplayStateService.java
│   │   └── AuthService.java
│   └── domain/                          # Services domaine
│       └── DisplayStateCalculator.java
├── infrastructure/
│   ├── security/
│   │   ├── JwtService.java
│   │   ├── JwtAuthenticationFilter.java
│   │   └── SecurityConfig.java
│   ├── websocket/
│   │   └── WebSocketConfig.java
│   ├── DataLoader.java                  # Données initiales
│   └── GlobalExceptionHandler.java
├── api/
│   ├── controller/                      # REST Controllers
│   │   ├── LineController.java
│   │   ├── StopController.java
│   │   ├── ScheduleController.java
│   │   ├── MessageController.java
│   │   ├── DeviceController.java
│   │   ├── DisplayController.java
│   │   └── AuthController.java
│   └── dto/                             # Data Transfer Objects
│       ├── request/
│       └── response/
└── repository/                          # Repositories JPA
    ├── LineRepository.java
    ├── StopRepository.java
    └── ...
```

### Entités

#### Relations

```
Line (1) ──── (N) Stop (1) ──── (N) TimedEntry
                    │
                    └──── (1) Device

BroadcastMessage ──── scope ──── Line/Stop (optionnel)
```

#### Exemple d'entité

```java
@Entity
@Table(name = "lines")
@Data
@NoArgsConstructor
public class Line {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(unique = true, nullable = false)
    private String code;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false)
    private String color;

    @OneToMany(mappedBy = "line", cascade = CascadeType.ALL)
    private List<Stop> stops = new ArrayList<>();
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
    public Line create(CreateLineRequest request) {
        Line line = new Line();
        line.setCode(request.code());
        line.setName(request.name());
        line.setColor(request.color());

        Line saved = lineRepository.save(line);

        // Publier l'événement
        eventPublisher.publishEvent(new NetworkChangedEvent(this));

        return saved;
    }
}
```

### Événements domaine

Les événements déclenchent le recalcul du DisplayState.

```java
public record NetworkChangedEvent(Object source) {}

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
├── app.config.ts                 # Configuration Angular
├── app.routes.ts                 # Définition des routes
├── core/
│   ├── auth/
│   │   ├── auth.service.ts       # Gestion authentification
│   │   ├── auth.guard.ts         # Protection des routes
│   │   └── auth.interceptor.ts   # Ajout token JWT
│   ├── api/
│   │   ├── line.service.ts
│   │   ├── stop.service.ts
│   │   ├── schedule.service.ts
│   │   ├── message.service.ts
│   │   ├── device.service.ts
│   │   └── display.service.ts
│   └── websocket/
│       └── websocket.service.ts  # Client STOMP
├── shared/
│   └── models/
│       └── index.ts              # Interfaces TypeScript
├── features/
│   ├── auth/
│   │   └── login/
│   ├── admin/
│   │   ├── dashboard/
│   │   ├── lines/
│   │   ├── stops/
│   │   ├── schedules/
│   │   ├── messages/
│   │   └── devices/
│   └── display/
│       └── kiosk/
└── layouts/
    ├── admin-layout/
    └── display-layout/
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

Angular 18 utilise des composants standalone par défaut.

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
       @NotBlank String color
   ) {}
   ```

2. **Validation** : Utiliser Bean Validation
   ```java
   @PostMapping
   public Line create(@Valid @RequestBody CreateLineRequest request) {
       return lineService.create(request);
   }
   ```

3. **Transactions** : Annoter les méthodes de service
   ```java
   @Transactional
   public Line update(UUID id, CreateLineRequest request) {
       // ...
   }
   ```

### Frontend

1. **Lazy loading** : Charger les modules à la demande
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
   }
   ```

---

## Tests

### Backend

```bash
# Exécuter tous les tests
./gradlew test

# Tests avec rapport de couverture
./gradlew test jacocoTestReport
```

### Frontend

```bash
# Tests unitaires
npm test

# Tests avec couverture
npm run test:coverage

# Tests e2e
npm run e2e
```

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

3. **Actuator** : http://localhost:8080/actuator

### Frontend

1. **Angular DevTools** : Extension Chrome/Firefox

2. **Console navigateur** : Vérifier les erreurs réseau

3. **Source maps** : Activées par défaut en développement
