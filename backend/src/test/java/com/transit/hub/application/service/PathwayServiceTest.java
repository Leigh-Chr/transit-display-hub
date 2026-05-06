package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.PathwayResponse;
import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.PathwayMode;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("PathwayService")
class PathwayServiceTest {

    @Mock
    private PathwayRepository pathwayRepository;

    @InjectMocks
    private PathwayService pathwayService;

    @Test
    @DisplayName("findPathwaysForStop sorts outgoing pathways before incoming, then by mode")
    void sortsOutgoingFirstThenByMode() {
        UUID stopAId = UUID.randomUUID();
        UUID stopBId = UUID.randomUUID();
        Stop stopA = stop(stopAId, "Quay A");
        Stop stopB = stop(stopBId, "Quay B");

        // Incoming elevator (B → A)
        Pathway incomingElevator = pathway("p1", stopB, stopA, PathwayMode.ELEVATOR, "Lift to A");
        // Outgoing stairs (A → B)
        Pathway outgoingStairs = pathway("p2", stopA, stopB, PathwayMode.STAIRS, "Stairs to B");
        // Outgoing escalator (A → B)
        Pathway outgoingEscalator = pathway("p3", stopA, stopB, PathwayMode.ESCALATOR, "Escalator to B");

        when(pathwayRepository.findTouchingStop(stopAId))
                .thenReturn(List.of(incomingElevator, outgoingStairs, outgoingEscalator));

        List<PathwayResponse> responses = pathwayService.findPathwaysForStop(stopAId);

        assertThat(responses).hasSize(3);
        // Outgoing first (STAIRS=ordinal 1, ESCALATOR=ordinal 3)
        assertThat(responses.get(0).externalId()).isEqualTo("p2"); // STAIRS, outgoing
        assertThat(responses.get(1).externalId()).isEqualTo("p3"); // ESCALATOR, outgoing
        assertThat(responses.get(2).externalId()).isEqualTo("p1"); // ELEVATOR, incoming
    }

    @Test
    @DisplayName("returns an empty list when no pathways touch the stop")
    void emptyWhenNoPathways() {
        UUID stopId = UUID.randomUUID();
        when(pathwayRepository.findTouchingStop(stopId)).thenReturn(List.of());

        List<PathwayResponse> responses = pathwayService.findPathwaysForStop(stopId);

        assertThat(responses).isEmpty();
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
