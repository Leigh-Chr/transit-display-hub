package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.StationPathwayGraphResponse;
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
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("StopPopupService")
class StopPopupServiceTest {

    @Mock
    private BookingRuleRepository bookingRuleRepository;

    @Mock
    private FlexStopTimeRepository flexStopTimeRepository;

    @Mock
    private LocationRepository locationRepository;

    @Mock
    private PathwayRepository pathwayRepository;

    @Mock
    private StationLevelRepository stationLevelRepository;

    @Mock
    private StopRepository stopRepository;

    @Mock
    private Clock clock;

    @InjectMocks
    private StopPopupService stopPopupService;

    @Test
    @DisplayName("findPathwayGraphForStop returns empty when the stop does not exist")
    void stationGraph_missingStop() {
        UUID id = UUID.randomUUID();
        when(stopRepository.findById(id)).thenReturn(Optional.empty());

        Optional<StationPathwayGraphResponse> result = stopPopupService.findPathwayGraphForStop(id);

        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("findPathwayGraphForStop falls back to the stop's own pathways when no parent")
    void stationGraph_freeStandingStop() {
        UUID id = UUID.randomUUID();
        Stop standalone = stop(id, "Free-standing");

        when(stopRepository.findById(id)).thenReturn(Optional.of(standalone));
        when(stopRepository.findChildIds(id)).thenReturn(List.of());
        when(stationLevelRepository.findByParentStopIdOrderByLevelIndex(id))
                .thenReturn(List.of());
        when(pathwayRepository.findTouchingAny(any())).thenReturn(List.of());

        Optional<StationPathwayGraphResponse> result = stopPopupService.findPathwayGraphForStop(id);

        assertThat(result).isPresent();
        assertThat(result.get().stationId()).isEqualTo(id);
        assertThat(result.get().stationName()).isEqualTo("Free-standing");
        assertThat(result.get().levels()).isEmpty();
    }

    @Test
    @DisplayName("findPathwayGraphForStop returns the parent station graph for a child platform")
    void stationGraph_childPlatformRoutesToParent() {
        UUID parentId = UUID.randomUUID();
        UUID childId = UUID.randomUUID();
        Stop parent = stop(parentId, "Centrale");
        Stop child = stop(childId, "Quai 1");
        child.setParentStop(parent);

        StationLevel level = StationLevel.builder()
                .levelIndex(1.0)
                .levelName("Mezzanine")
                .build();

        when(stopRepository.findById(childId)).thenReturn(Optional.of(child));
        when(stopRepository.findChildIds(parentId)).thenReturn(List.of(childId));
        when(stationLevelRepository.findByParentStopIdOrderByLevelIndex(parentId))
                .thenReturn(List.of(level));
        when(pathwayRepository.findTouchingAny(any())).thenReturn(List.of());

        Optional<StationPathwayGraphResponse> result = stopPopupService.findPathwayGraphForStop(childId);

        assertThat(result).isPresent();
        assertThat(result.get().stationId()).isEqualTo(parentId);
        assertThat(result.get().stationName()).isEqualTo("Centrale");
        assertThat(result.get().levels()).hasSize(1);
    }

    @Test
    @DisplayName("findPathwayGraphForStop sorts pathways by mode then signposted text")
    void stationGraph_sortsPathwaysByMode() {
        UUID id = UUID.randomUUID();
        Stop stop = stop(id, "Free-standing");
        Stop other = stop(UUID.randomUUID(), "Other");

        Pathway elevator = pathway("e1", stop, other, PathwayMode.ELEVATOR, "Lift");
        Pathway stairs = pathway("s1", stop, other, PathwayMode.STAIRS, "Stairs");

        when(stopRepository.findById(id)).thenReturn(Optional.of(stop));
        when(stopRepository.findChildIds(id)).thenReturn(List.of());
        when(stationLevelRepository.findByParentStopIdOrderByLevelIndex(id))
                .thenReturn(List.of());
        when(pathwayRepository.findTouchingAny(any()))
                .thenReturn(List.of(elevator, stairs));

        StationPathwayGraphResponse result = stopPopupService.findPathwayGraphForStop(id).orElseThrow();

        // STAIRS (ordinal 1) comes before ELEVATOR (ordinal 4)
        assertThat(result.pathways()).hasSize(2);
        assertThat(result.pathways().get(0).externalId()).isEqualTo("s1");
        assertThat(result.pathways().get(1).externalId()).isEqualTo("e1");
    }

    private static Stop stop(UUID id, String name) {
        Stop s = new Stop();
        s.setId(id);
        s.setName(name);
        return s;
    }

    private static Pathway pathway(String externalId, Stop from, Stop to,
                                   PathwayMode mode, String signpostedAs) {
        return Pathway.builder()
                .id(UUID.randomUUID())
                .externalId(externalId)
                .fromStop(from)
                .toStop(to)
                .pathwayMode(mode)
                .bidirectional(false)
                .signpostedAs(signpostedAs)
                .build();
    }
}
