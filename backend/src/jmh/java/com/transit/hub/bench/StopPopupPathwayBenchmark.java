package com.transit.hub.bench;

import com.transit.hub.application.dto.response.StationPathwayGraphResponse;
import com.transit.hub.application.service.StopPopupService;
import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.StationLevel;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.PathwayMode;
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
import java.util.ArrayList;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * Measures {@link StopPopupService#findPathwayGraphForStop} on a stubbed
 * topology of N pathways. The interesting cost is the comparator chain
 * (mode ordinal + signposted_as), the {@link Pathway}-to-DTO mapping
 * and the level join.
 *
 * <p>Sweep covers a small free-standing stop (5 pathways) up to a
 * mega-station like Châtelet-Les-Halles or Gare du Nord (200+).
 */
@State(Scope.Benchmark)
@BenchmarkMode(Mode.AverageTime)
@OutputTimeUnit(TimeUnit.MICROSECONDS)
public class StopPopupPathwayBenchmark {

    @Param({"5", "30", "200"})
    public int pathwayCount;

    private StopPopupService service;
    private UUID stopId;

    @Setup
    public void setUp() {
        StopRepository stopRepo = Mockito.mock(StopRepository.class);
        StationLevelRepository levelRepo = Mockito.mock(StationLevelRepository.class);
        PathwayRepository pathwayRepo = Mockito.mock(PathwayRepository.class);
        BookingRuleRepository bookingRepo = Mockito.mock(BookingRuleRepository.class);
        FlexStopTimeRepository flexRepo = Mockito.mock(FlexStopTimeRepository.class);
        LocationRepository locationRepo = Mockito.mock(LocationRepository.class);
        Clock clock = Clock.systemDefaultZone();

        Stop station = new Stop();
        station.setId(UUID.randomUUID());
        station.setName("Bench station");
        Stop platform = new Stop();
        platform.setId(UUID.randomUUID());
        platform.setName("Bench platform");
        platform.setParentStop(station);
        stopId = platform.getId();
        Mockito.when(stopRepo.findById(stopId)).thenReturn(Optional.of(platform));

        // 3 levels — typical metro hub
        List<StationLevel> levels = List.of(
                StationLevel.builder().id(UUID.randomUUID()).externalId("L-1")
                        .levelIndex(-1.0).levelName("Quai").build(),
                StationLevel.builder().id(UUID.randomUUID()).externalId("L0")
                        .levelIndex(0.0).levelName("Salle des billets").build(),
                StationLevel.builder().id(UUID.randomUUID()).externalId("L1")
                        .levelIndex(1.0).levelName("Sortie").build()
        );
        Mockito.when(levelRepo.findByParentStopIdOrderByLevelIndex(station.getId()))
                .thenReturn(levels);

        // Children = the platform itself; the service queries the
        // children + station, then the pathway repo with that list.
        Mockito.when(stopRepo.findChildIds(station.getId()))
                .thenReturn(List.of(platform.getId()));

        // Build N pathways cycling through every PathwayMode so the
        // comparator gets exercised across the enum.
        PathwayMode[] modes = PathwayMode.values();
        List<Pathway> pathways = new ArrayList<>(pathwayCount);
        for (int i = 0; i < pathwayCount; i++) {
            Stop endpoint = new Stop();
            endpoint.setId(UUID.randomUUID());
            endpoint.setName("Endpoint " + i);
            Pathway p = Pathway.builder()
                    .id(UUID.randomUUID())
                    .externalId("PW" + i)
                    .fromStop(platform)
                    .toStop(endpoint)
                    .pathwayMode(modes[i % modes.length])
                    .bidirectional(i % 3 != 0)
                    .traversalTimeSeconds(20 + (i % 90))
                    .signpostedAs("Vers " + (i % 4 == 0 ? "quai" : "sortie"))
                    .build();
            pathways.add(p);
        }
        Mockito.when(pathwayRepo.findTouchingAny(Mockito.<Collection<UUID>>any()))
                .thenReturn(pathways);

        service = new StopPopupService(bookingRepo, flexRepo, locationRepo,
                pathwayRepo, levelRepo, stopRepo, clock);
    }

    @Benchmark
    public Optional<StationPathwayGraphResponse> findStationGraph() {
        return service.findPathwayGraphForStop(stopId);
    }
}
