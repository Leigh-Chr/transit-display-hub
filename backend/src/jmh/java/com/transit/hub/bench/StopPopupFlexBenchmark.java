package com.transit.hub.bench;

import com.transit.hub.application.dto.response.FlexStopTimeResponse;
import com.transit.hub.application.service.StopPopupService;
import com.transit.hub.domain.model.Location;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import org.openjdk.jmh.annotations.Benchmark;
import org.openjdk.jmh.annotations.BenchmarkMode;
import org.openjdk.jmh.annotations.Mode;
import org.openjdk.jmh.annotations.OutputTimeUnit;
import org.openjdk.jmh.annotations.Param;
import org.openjdk.jmh.annotations.Scope;
import org.openjdk.jmh.annotations.Setup;
import org.openjdk.jmh.annotations.State;
import org.mockito.Mockito;

import java.time.Clock;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Measures {@link StopPopupService#findFlexWindowsForLocation} with
 * a stubbed repository. The interesting cost is the
 * {@code serviceActiveOn} filter chain (date window + exception scan +
 * day-of-week switch) plus the sort by start time.
 *
 * <p>The size sweep matches realistic flex catalogues — 10 windows per
 * day for a small DRT operator, 100 for a metro-area on-demand service,
 * 500 for a very large multi-zone TAD network.
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class StopPopupFlexBenchmark {

    @Param({"10", "100", "500"})
    public int windowCount;

    private StopPopupService service;
    private String locationExternalId;

    @Setup
    public void setUp() {
        FlexStopTimeRepository flexRepo = Mockito.mock(FlexStopTimeRepository.class);
        BookingRuleRepository bookingRepo = Mockito.mock(BookingRuleRepository.class);
        LocationRepository locationRepo = Mockito.mock(LocationRepository.class);
        PathwayRepository pathwayRepo = Mockito.mock(PathwayRepository.class);
        StationLevelRepository levelRepo = Mockito.mock(StationLevelRepository.class);
        StopRepository stopRepo = Mockito.mock(StopRepository.class);

        Clock clock = Clock.fixed(LocalDate.of(2026, 5, 9)
                .atStartOfDay(ZoneId.of("Europe/Paris")).toInstant(),
                ZoneId.of("Europe/Paris"));
        locationExternalId = "FLEX_BENCH";

        Location location = new Location();
        location.setId(UUID.randomUUID());
        location.setExternalId(locationExternalId);
        location.setName("Bench zone");

        // Half the calendars run today (Saturday in fixed clock above);
        // the other half are weekday-only — exercises the filter path.
        ServiceCalendar weekendCal = ServiceCalendar.builder()
                .id(UUID.randomUUID())
                .externalId("WEEKEND")
                .saturday(true).sunday(true)
                .startDate(LocalDate.of(2025, 1, 1))
                .endDate(LocalDate.of(2027, 12, 31))
                .exceptions(new ArrayList<>())
                .build();
        ServiceCalendar weekdayCal = ServiceCalendar.builder()
                .id(UUID.randomUUID())
                .externalId("WEEKDAY")
                .monday(true).tuesday(true).wednesday(true)
                .thursday(true).friday(true)
                .startDate(LocalDate.of(2025, 1, 1))
                .endDate(LocalDate.of(2027, 12, 31))
                .exceptions(new ArrayList<>())
                .build();

        List<FlexStopTime> windows = new ArrayList<>(windowCount);
        for (int i = 0; i < windowCount; i++) {
            FlexStopTime fst = FlexStopTime.builder()
                    .id(UUID.randomUUID())
                    .location(location)
                    .startPickupDropOffWindow(LocalTime.of(6 + (i % 12), (i * 5) % 60))
                    .endPickupDropOffWindow(LocalTime.of(6 + (i % 12), ((i * 5) % 60 + 30) % 60))
                    .serviceCalendar(i % 2 == 0 ? weekendCal : weekdayCal)
                    .build();
            windows.add(fst);
        }
        Mockito.when(flexRepo.findByLocationExternalId(locationExternalId)).thenReturn(windows);

        service = new StopPopupService(bookingRepo, flexRepo, locationRepo,
                pathwayRepo, levelRepo, stopRepo, clock);
    }

    @Benchmark
    public List<FlexStopTimeResponse> findToday() {
        return service.findFlexWindowsForLocation(locationExternalId, null);
    }

    @Benchmark
    public List<FlexStopTimeResponse> findExplicitDate() {
        return service.findFlexWindowsForLocation(locationExternalId, LocalDate.of(2026, 5, 11));
    }
}
