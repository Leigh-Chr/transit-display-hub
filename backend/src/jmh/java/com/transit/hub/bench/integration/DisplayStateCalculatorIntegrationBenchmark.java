package com.transit.hub.bench.integration;

import com.transit.hub.TransitDisplayHubApplication;
import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.service.DisplayStateCalculator;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Level;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.openjdk.jmh.annotations.TearDown;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * End-to-end benchmark of {@link DisplayStateCalculator#calculateForStop}
 * through the real Spring Boot wiring — repositories, transactions,
 * Hibernate, the in-memory H2 datasource. The micro-benchmarks under
 * {@code com.transit.hub.bench} measure pure-compute hot paths; this
 * one measures the wall-clock cost of a kiosk refresh including the
 * datasource round-trips.
 *
 * <p>The fixture is a minimalist single-line / single-stop network with
 * a parameterised number of schedules placed inside the calculator's
 * 30-minute time window. Smaller numbers approximate a low-traffic bus
 * line; larger numbers approximate a metro trunk where the borne
 * receives a busy departure list.
 *
 * <p>Cost shape: each {@code @Setup(Trial)} pays a Spring Boot cold
 * start (~3 s on a recent laptop) and the fixture insert. The
 * benchmark itself runs at the kiosk-refresh cadence and is what we
 * actually want to measure.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MILLISECONDS)
public class DisplayStateCalculatorIntegrationBenchmark {

    @Param({"5", "30"})
    public int scheduleCount;

    private ConfigurableApplicationContext ctx;
    private DisplayStateCalculator calculator;
    private UUID stopId;

    @Setup(Level.Trial)
    public void setUp() {
        Map<String, Object> props = new HashMap<>();
        // Unique H2 instance per fork so concurrent forks don't collide.
        // DB_CLOSE_DELAY=-1 keeps the database alive while the context
        // is up; DB_CLOSE_ON_EXIT=FALSE prevents Spring's shutdown hook
        // from racing with JMH's iteration teardown.
        props.put("spring.datasource.url",
                "jdbc:h2:mem:bench-" + UUID.randomUUID() + ";DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE");
        props.put("spring.datasource.driver-class-name", "org.h2.Driver");
        props.put("spring.datasource.username", "sa");
        props.put("spring.datasource.password", "");
        props.put("spring.jpa.hibernate.ddl-auto", "create-drop");
        props.put("spring.flyway.enabled", "false");
        props.put("app.data-loader.source", "");
        props.put("app.jwt.secret",
                "bench-secret-key-for-jwt-token-generation-must-be-at-least-256-bits-long");

        ctx = new SpringApplicationBuilder(TransitDisplayHubApplication.class)
                .properties(props)
                .web(WebApplicationType.NONE)
                .run();

        calculator = ctx.getBean(DisplayStateCalculator.class);

        LineRepository lineRepo = ctx.getBean(LineRepository.class);
        StopRepository stopRepo = ctx.getBean(StopRepository.class);
        ItineraryRepository itinRepo = ctx.getBean(ItineraryRepository.class);
        ServiceCalendarRepository calendarRepo = ctx.getBean(ServiceCalendarRepository.class);
        ScheduleRepository scheduleRepo = ctx.getBean(ScheduleRepository.class);

        Line line = Line.builder()
                .code("L1")
                .name("Bench Line")
                .color("#FF5733")
                .build();
        line = lineRepo.save(line);

        Stop stop = Stop.builder()
                .name("Bench Stop")
                .lines(new HashSet<>(Set.of(line)))
                .latitude(45.18).longitude(5.72)
                .build();
        stop = stopRepo.save(stop);
        line.getStops().add(stop);
        line = lineRepo.save(line);

        Itinerary itinerary = Itinerary.builder()
                .name("Bench Itinerary")
                .line(line)
                .build();
        itinerary = itinRepo.save(itinerary);

        ServiceCalendar calendar = ServiceCalendar.builder()
                .startDate(LocalDate.now().minusYears(1))
                .endDate(LocalDate.now().plusYears(1))
                .monday(true).tuesday(true).wednesday(true)
                .thursday(true).friday(true).saturday(true).sunday(true)
                .build();
        calendar = calendarRepo.save(calendar);

        // Drop schedules at minute granularity inside the 30-min window
        // around "now". Past horaires also count — DisplayStateCalculator
        // filters them itself, which is what we want to measure.
        LocalTime base = LocalTime.now().withSecond(0).withNano(0);
        for (int i = 0; i < scheduleCount; i++) {
            LocalTime when = base.plusMinutes(i % 30);
            Schedule sched = Schedule.builder()
                    .time(when)
                    .stop(stop)
                    .itinerary(itinerary)
                    .serviceCalendar(calendar)
                    .pickupType((short) 0)
                    .build();
            scheduleRepo.save(sched);
        }

        stopId = stop.getId();
    }

    @Benchmark
    public DisplayState calculateForStop() {
        return calculator.calculateForStop(stopId);
    }

    @TearDown(Level.Trial)
    public void tearDown() {
        if (ctx != null) {
            ctx.close();
        }
    }
}
