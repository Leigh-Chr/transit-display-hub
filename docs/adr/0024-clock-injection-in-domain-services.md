# ADR 0024 — Inject `Clock` into domain services that read "now"

**Status:** Accepted

## Context

`DisplayStateCalculator` computes a 30-minute upcoming-departure window
for each kiosk request. The original implementation read time directly:

```java
LocalTime now      = LocalTime.now(zone);
LocalDate today    = LocalDate.now(zone);
Instant   instant  = Instant.now();
```

The 30-minute window crosses midnight when wall-clock time is past
23:30 local. The calculator branches on this:

```java
if (windowEnd.isAfter(now)) {
    // single in-window query
    return scheduleRepository.findByStopIdAndTimeWindowWithItinerary(...);
}
// cross-midnight: union of "after now today" + "before windowEnd tomorrow"
return ...findByStopIdAndTimeAfter... + ...findByStopIdAndTimeBeforeOrEqual...
```

Tests stubbed only the in-window variant. Past 23:30 they routed to
the cross-midnight branch, the in-window stub never fired, and
Mockito's strict-stubbing audit collapsed the entire DSC suite with
`UnnecessaryStubbingException`. The failures were
time-of-day-dependent — green at 22:00, red at 23:35 — which is the
worst kind of flake to chase on CI.

The same brittleness applied to two more assertions in the same
class (`getMinutesUntil` minute-boundary, `formatRelativeTime`
"Imminent" vs "1 min").

## Decision

**Domain services that read "now" take a `Clock` dependency through
the constructor, and never call `LocalTime.now()` /
`Instant.now()` / `LocalDate.now()` directly.** Production wires
`Clock.systemDefaultZone()` via a single `ClockConfig` bean. Tests pin
`Clock.fixed(<midday instant>, <zone>)` so windows never straddle
midnight at test time.

### Production wiring

```java
@Configuration
public class ClockConfig {
    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
```

### Service signature

```java
public class DisplayStateCalculator {
    private final Clock clock;
    // …existing fields…

    public DisplayState calculateForStop(UUID stopId) {
        ZoneId zone = resolveZone(stop);
        Clock zonedClock = clock.withZone(zone);
        LocalTime now    = LocalTime.now(zonedClock);
        LocalDate today  = LocalDate.now(zonedClock);
        // …
        Instant instant  = clock.instant();
    }
}
```

### Test setup

```java
private static final Instant FIXED_NOW =
        Instant.parse("2026-01-15T10:00:00Z");
private final Clock clock =
        Clock.fixed(FIXED_NOW, ZoneId.of("Europe/Paris"));

private DisplayStateCalculator calculator;

@BeforeEach
void setUp() {
    // Manual constructor wiring — @InjectMocks doesn't pick up
    // non-@Mock fields like our Clock.fixed instance.
    calculator = new DisplayStateCalculator(
            stopRepository, scheduleRepository, /* … */ clock);
}
```

## Consequences

- **DSC tests are deterministic regardless of wall-clock time.** The
  cross-midnight branch is no longer accidentally exercised.
- **`@InjectMocks` no longer applies** — DSC has a non-mock dependency,
  so the test class constructs it manually. Acceptable trade-off; the
  factory call is short.
- **Pattern extends naturally** to other time-sensitive services
  (broadcast message activeness, schedule window helpers). Adopt
  on-demand, not retroactively — the calculator was the only known
  flake.
- **Production behaviour unchanged.** The default-zone clock matches
  the pre-existing `LocalTime.now(zone)` behaviour 1:1.
- **No new dep.** `java.time.Clock` is JDK; the bean is a one-liner.
- **Caveat for `generatedAt` assertions**: tests previously sandwiched
  the calculator call between two `Instant.now()` reads and asserted
  the timestamp was between them. With a pinned clock that becomes a
  single equality on the fixed instant — clearer, but the original
  shape is gone.
