package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkLine;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkStop;
import com.transit.hub.domain.model.*;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.CacheManager;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("NetworkMapService")
class NetworkMapServiceTest {

    @Mock
    private LineRepository lineRepository;

    @Mock
    private StopRepository stopRepository;

    @Mock
    private BroadcastMessageRepository broadcastMessageRepository;

    @Mock
    private CacheManager cacheManager;

    @InjectMocks
    private NetworkMapService networkMapService;

    @Nested
    @DisplayName("getNetworkMap")
    class GetNetworkMap {

        @Test
        @DisplayName("returns lines and stops")
        void returnsLinesAndStops() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop stopA = TestDataFactory.createStop("Station A", line);
            Stop stopB = TestDataFactory.createStop("Station B", line);
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "Direction B", stopA, stopB);
            line.getItineraries().add(itinerary);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(stopA, stopB));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.lines()).hasSize(1);
            assertThat(result.lines().get(0).code()).isEqualTo("M1");
            assertThat(result.stops()).hasSize(2);
            assertThat(result.stops()).extracting(NetworkStop::name)
                    .containsExactlyInAnyOrder("Station A", "Station B");
        }

        @Test
        @DisplayName("returns default bounds when no stops")
        void returnsDefaultBoundsWhenNoStops() {
            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of());
            when(stopRepository.findAllWithLines()).thenReturn(List.of());

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.lines()).isEmpty();
            assertThat(result.stops()).isEmpty();
            assertThat(result.bounds().minX()).isEqualTo(0);
            assertThat(result.bounds().minY()).isEqualTo(0);
            assertThat(result.bounds().maxX()).isEqualTo(100);
            assertThat(result.bounds().maxY()).isEqualTo(100);
        }

        @Test
        @DisplayName("itinerary stop IDs are in position order")
        void itineraryStopIdsInOrder() {
            Line line = TestDataFactory.createLine("T1", "Tram 1", "#00FF00");
            Stop stopA = TestDataFactory.createStop("Alpha", line);
            Stop stopB = TestDataFactory.createStop("Beta", line);
            Stop stopC = TestDataFactory.createStop("Gamma", line);
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line, "To Gamma", stopA, stopB, stopC);
            line.getItineraries().add(itinerary);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(stopA, stopB, stopC));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            NetworkLine networkLine = result.lines().get(0);
            assertThat(networkLine.itineraries()).hasSize(1);
            List<UUID> stopIds = networkLine.itineraries().get(0);
            assertThat(stopIds).containsExactly(stopA.getId(), stopB.getId(), stopC.getId());
        }

        @Test
        @DisplayName("calculates bounds from stop coordinates")
        void calculatesBoundsFromCoordinates() {
            Line line = TestDataFactory.createLine("B1", "Bus 1", "#0000FF");
            Stop stop1 = TestDataFactory.createStop("Stop 1", line);
            stop1.setSchematicX(10.0);
            stop1.setSchematicY(20.0);
            Stop stop2 = TestDataFactory.createStop("Stop 2", line);
            stop2.setSchematicX(50.0);
            stop2.setSchematicY(80.0);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(stop1, stop2));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.bounds().minX()).isEqualTo(10.0);
            assertThat(result.bounds().minY()).isEqualTo(20.0);
            assertThat(result.bounds().maxX()).isEqualTo(50.0);
            assertThat(result.bounds().maxY()).isEqualTo(80.0);
        }
    }

    @Nested
    @DisplayName("getAlerts")
    class GetAlerts {

        @Test
        @DisplayName("returns empty response when no active messages")
        void returnsEmptyWhenNoActiveMessages() {
            when(broadcastMessageRepository.findActiveMessages(any(Instant.class))).thenReturn(List.of());

            AlertsResponse result = networkMapService.getAlerts();

            assertThat(result.networkAlerts()).isEmpty();
            assertThat(result.lineAlerts()).isEmpty();
            assertThat(result.stopAlerts()).isEmpty();
        }

        @Test
        @DisplayName("categorizes alerts by scope")
        void categorizesByScope() {
            UUID lineId = UUID.randomUUID();
            UUID stopId = UUID.randomUUID();
            BroadcastMessage networkMsg = TestDataFactory.createNetworkMessage();
            BroadcastMessage lineMsg = TestDataFactory.createLineMessage(lineId);
            BroadcastMessage stopMsg = TestDataFactory.createStopMessage(stopId);

            when(broadcastMessageRepository.findActiveMessages(any(Instant.class)))
                    .thenReturn(List.of(networkMsg, lineMsg, stopMsg));

            AlertsResponse result = networkMapService.getAlerts();

            assertThat(result.networkAlerts()).hasSize(1);
            assertThat(result.lineAlerts()).containsKey(lineId);
            assertThat(result.lineAlerts().get(lineId)).hasSize(1);
            assertThat(result.stopAlerts()).containsKey(stopId);
            assertThat(result.stopAlerts().get(stopId)).hasSize(1);
        }

        @Test
        @DisplayName("groups multiple alerts for same scope")
        void groupsMultipleAlertsForSameScope() {
            UUID lineId = UUID.randomUUID();
            BroadcastMessage msg1 = TestDataFactory.createLineMessage(lineId);
            BroadcastMessage msg2 = TestDataFactory.createCriticalMessage(MessageScope.LINE, lineId);

            when(broadcastMessageRepository.findActiveMessages(any(Instant.class)))
                    .thenReturn(List.of(msg1, msg2));

            AlertsResponse result = networkMapService.getAlerts();

            assertThat(result.lineAlerts().get(lineId)).hasSize(2);
            assertThat(result.lineAlerts().get(lineId))
                    .extracting(a -> a.severity())
                    .contains(MessageSeverity.INFO, MessageSeverity.CRITICAL);
        }
    }
}
