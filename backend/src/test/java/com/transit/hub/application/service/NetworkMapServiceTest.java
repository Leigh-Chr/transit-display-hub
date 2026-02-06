package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertMessage;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkLine;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkStop;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
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
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;



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

        @Test
        @DisplayName("returns alerts of all three scopes in correct collections")
        void returnsAlertsOfAllScopesCorrectly() {
            UUID lineId = UUID.randomUUID();
            UUID stopId = UUID.randomUUID();
            BroadcastMessage networkMsg = TestDataFactory.createNetworkMessage();
            networkMsg.setTitle("Network Issue");
            BroadcastMessage lineMsg = TestDataFactory.createLineMessage(lineId);
            lineMsg.setTitle("Line Delay");
            BroadcastMessage stopMsg = TestDataFactory.createStopMessage(stopId);
            stopMsg.setTitle("Stop Closed");
            BroadcastMessage criticalNetwork = TestDataFactory.createCriticalMessage(MessageScope.NETWORK, null);
            criticalNetwork.setTitle("Critical Network");

            when(broadcastMessageRepository.findActiveMessages(any(Instant.class)))
                    .thenReturn(List.of(networkMsg, lineMsg, stopMsg, criticalNetwork));

            AlertsResponse result = networkMapService.getAlerts();

            assertThat(result.networkAlerts()).hasSize(2);
            assertThat(result.networkAlerts()).extracting(AlertMessage::title)
                    .containsExactlyInAnyOrder("Network Issue", "Critical Network");
            assertThat(result.lineAlerts()).containsKey(lineId);
            assertThat(result.lineAlerts().get(lineId)).hasSize(1);
            assertThat(result.stopAlerts()).containsKey(stopId);
            assertThat(result.stopAlerts().get(stopId)).hasSize(1);
        }
    }

    @Nested
    @DisplayName("Empty network")
    class EmptyNetwork {

        @Test
        @DisplayName("returns empty lines and stops with default bounds for empty network")
        void returnsEmptyNetworkWithDefaultBounds() {
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
    }

    @Nested
    @DisplayName("Bounds calculation edge cases")
    class BoundsCalculationEdgeCases {

        @Test
        @DisplayName("returns default bounds when all stops have null coordinates")
        void returnsDefaultBoundsWhenAllCoordinatesNull() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop stop1 = TestDataFactory.createStop("Station A", line);
            // No schematicX/Y or lat/lon set -- all null
            Stop stop2 = TestDataFactory.createStop("Station B", line);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(stop1, stop2));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.bounds().minX()).isEqualTo(0);
            assertThat(result.bounds().minY()).isEqualTo(0);
            assertThat(result.bounds().maxX()).isEqualTo(100);
            assertThat(result.bounds().maxY()).isEqualTo(100);
        }

        @Test
        @DisplayName("returns identical min and max when all stops have same coordinates")
        void returnsIdenticalBoundsWhenAllStopsSameCoordinates() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop stop1 = TestDataFactory.createStop("Station A", line);
            stop1.setSchematicX(50.0);
            stop1.setSchematicY(75.0);
            Stop stop2 = TestDataFactory.createStop("Station B", line);
            stop2.setSchematicX(50.0);
            stop2.setSchematicY(75.0);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(stop1, stop2));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.bounds().minX()).isEqualTo(50.0);
            assertThat(result.bounds().minY()).isEqualTo(75.0);
            assertThat(result.bounds().maxX()).isEqualTo(50.0);
            assertThat(result.bounds().maxY()).isEqualTo(75.0);
        }
    }

    @Nested
    @DisplayName("Cache eviction")
    class CacheEviction {

        @Test
        @DisplayName("evicts networkMap and networkAlerts caches on NetworkChangedEvent")
        void evictsCachesOnNetworkChangedEvent() {
            Cache networkMapCache = mock(Cache.class);
            Cache networkAlertsCache = mock(Cache.class);
            when(cacheManager.getCache("networkMap")).thenReturn(networkMapCache);
            when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);

            networkMapService.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));

            verify(networkMapCache).clear();
            verify(networkAlertsCache).clear();
        }

        @Test
        @DisplayName("evicts only networkAlerts cache on MessageChangedEvent")
        void evictsAlertsCacheOnMessageChangedEvent() {
            Cache networkAlertsCache = mock(Cache.class);
            when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);

            networkMapService.onMessageChanged(new MessageChangedEvent(this, Set.of()));

            verify(networkAlertsCache).clear();
            verify(cacheManager, never()).getCache("networkMap");
        }

        @Test
        @DisplayName("handles null cache gracefully during eviction")
        void handlesNullCacheGracefully() {
            when(cacheManager.getCache("networkMap")).thenReturn(null);
            when(cacheManager.getCache("networkAlerts")).thenReturn(null);

            // Should not throw
            networkMapService.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));
        }
    }
}
