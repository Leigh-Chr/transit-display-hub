package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertMessage;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkLine;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkStop;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkTransfer;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.*;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TransferRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
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
    private TransferRepository transferRepository;

    @Mock
    private com.transit.hub.infrastructure.persistence.ScheduleRepository scheduleRepository;

    @Mock
    private com.transit.hub.infrastructure.persistence.FlexStopTimeRepository flexStopTimeRepository;

    @Mock
    private com.transit.hub.infrastructure.persistence.AreaRepository areaRepository;

    @Mock
    private CacheManager cacheManager;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private com.transit.hub.infrastructure.websocket.ActiveDisplayTracker activeDisplayTracker;

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
    @DisplayName("Phase 1.3 parent / platform collapse")
    class Phase13ParentCollapse {

        private Stop parentStation(String name) {
            Stop parent = TestDataFactory.createStop(name);
            parent.setLocationType((short) 1);
            return parent;
        }

        private Stop platformOf(Stop parent, String code, Line line) {
            Stop p = TestDataFactory.createStop(parent.getName() + " quay " + code, line);
            p.setPlatformCode(code);
            p.setParentStop(parent);
            return p;
        }

        @Test
        @DisplayName("platforms collapse into their parent station — only the parent shows up as a surface stop")
        void platformsCollapseIntoParent() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop parent = parentStation("Central");
            Stop platformA = platformOf(parent, "A", line);
            Stop platformB = platformOf(parent, "B", line);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(parent, platformA, platformB));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.stops()).hasSize(1);
            assertThat(result.stops().get(0).id()).isEqualTo(parent.getId());
            assertThat(result.stops().get(0).name()).isEqualTo("Central");
        }

        @Test
        @DisplayName("parent station inherits the union of its children's line codes")
        void parentInheritsChildLineCodes() {
            Line m1 = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Line m2 = TestDataFactory.createLine("M2", "Metro 2", "#00FF00");
            Stop parent = parentStation("Interchange");
            Stop platform1 = platformOf(parent, "1", m1);
            Stop platform2 = platformOf(parent, "2", m2);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(m1, m2));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(parent, platform1, platform2));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.stops()).hasSize(1);
            assertThat(result.stops().get(0).lineCodes()).containsExactly("M1", "M2");
        }

        @Test
        @DisplayName("itinerary stop ids are remapped from platform UUID to parent UUID")
        void itineraryRemappedToParent() {
            Line line = TestDataFactory.createLine("T1", "Tram 1", "#FF0000");
            Stop terminusStart = TestDataFactory.createStop("Start", line);
            Stop centralParent = parentStation("Central");
            Stop centralPlatform = platformOf(centralParent, "A", line);
            Stop terminusEnd = TestDataFactory.createStop("End", line);
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line,
                    "ToEnd", terminusStart, centralPlatform, terminusEnd);
            line.getItineraries().add(itinerary);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines())
                    .thenReturn(List.of(terminusStart, centralParent, centralPlatform, terminusEnd));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            List<UUID> stopIds = result.lines().get(0).itineraries().get(0);
            assertThat(stopIds).containsExactly(
                    terminusStart.getId(), centralParent.getId(), terminusEnd.getId());
        }

        @Test
        @DisplayName("consecutive platforms of the same parent collapse to a single itinerary entry")
        void consecutivePlatformsDedupe() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop start = TestDataFactory.createStop("Start", line);
            Stop centralParent = parentStation("Central");
            Stop centralA = platformOf(centralParent, "A", line);
            Stop centralB = platformOf(centralParent, "B", line);
            Stop end = TestDataFactory.createStop("End", line);
            Itinerary itinerary = TestDataFactory.createItineraryWithStops(line,
                    "ToEnd", start, centralA, centralB, end);
            line.getItineraries().add(itinerary);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines())
                    .thenReturn(List.of(start, centralParent, centralA, centralB, end));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            List<UUID> stopIds = result.lines().get(0).itineraries().get(0);
            assertThat(stopIds).containsExactly(start.getId(), centralParent.getId(), end.getId());
        }

        @Test
        @DisplayName("transfers between platforms of the same station are dropped (intra-station walking)")
        void intraStationTransfersDropped() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop parent = parentStation("Central");
            Stop platformA = platformOf(parent, "A", line);
            Stop platformB = platformOf(parent, "B", line);
            Transfer transfer = Transfer.builder()
                    .id(UUID.randomUUID())
                    .fromStop(platformA)
                    .toStop(platformB)
                    .transferType((short) 0)
                    .minTransferTime(60)
                    .build();

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(parent, platformA, platformB));
            when(transferRepository.findAllWithStops()).thenReturn(List.of(transfer));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.transfers()).isEmpty();
        }

        @Test
        @DisplayName("transfers between platforms of different stations collapse to parent UUIDs")
        void interStationTransfersCollapseToParents() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop parentA = parentStation("Alpha");
            Stop platformA = platformOf(parentA, "1", line);
            Stop parentB = parentStation("Beta");
            Stop platformB = platformOf(parentB, "1", line);
            Transfer transfer = Transfer.builder()
                    .id(UUID.randomUUID())
                    .fromStop(platformA)
                    .toStop(platformB)
                    .transferType((short) 2)
                    .minTransferTime(120)
                    .build();

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines())
                    .thenReturn(List.of(parentA, platformA, parentB, platformB));
            when(transferRepository.findAllWithStops()).thenReturn(List.of(transfer));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.transfers()).hasSize(1);
            NetworkTransfer t = result.transfers().get(0);
            assertThat(t.fromStopId()).isEqualTo(parentA.getId());
            assertThat(t.toStopId()).isEqualTo(parentB.getId());
            assertThat(t.minTransferTimeSeconds()).isEqualTo(120);
        }

        @Test
        @DisplayName("transfer qualifiers from_route_id / to_route_id resolve to line UUIDs")
        void transferQualifiersResolveToLineIds() {
            Line lineA = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            lineA.setExternalId("ROUTE_A");
            Line lineB = TestDataFactory.createLine("M2", "Metro 2", "#00FF00");
            lineB.setExternalId("ROUTE_B");
            Stop parentA = parentStation("Alpha");
            Stop platformA = platformOf(parentA, "1", lineA);
            Stop parentB = parentStation("Beta");
            Stop platformB = platformOf(parentB, "1", lineB);
            Transfer generic = Transfer.builder()
                    .id(UUID.randomUUID())
                    .fromStop(platformA).toStop(platformB)
                    .transferType((short) 2).minTransferTime(120)
                    .build();
            Transfer routeSpecific = Transfer.builder()
                    .id(UUID.randomUUID())
                    .fromStop(platformA).toStop(platformB)
                    .transferType((short) 1).minTransferTime(60)
                    .fromRouteId("ROUTE_A").toRouteId("ROUTE_B")
                    .build();

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(lineA, lineB));
            when(stopRepository.findAllWithLines())
                    .thenReturn(List.of(parentA, platformA, parentB, platformB));
            when(transferRepository.findAllWithStops()).thenReturn(List.of(generic, routeSpecific));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.transfers()).hasSize(2);
            NetworkTransfer specific = result.transfers().stream()
                    .filter(t -> t.fromLineId() != null)
                    .findFirst().orElseThrow();
            assertThat(specific.fromLineId()).isEqualTo(lineA.getId());
            assertThat(specific.toLineId()).isEqualTo(lineB.getId());
            assertThat(specific.transferType()).isEqualTo((short) 1);
            NetworkTransfer fallback = result.transfers().stream()
                    .filter(t -> t.fromLineId() == null)
                    .findFirst().orElseThrow();
            assertThat(fallback.transferType()).isEqualTo((short) 2);
        }

        @Test
        @DisplayName("parent station hasOnDemand when any of its child platforms has on-request schedule")
        void parentInheritsHasOnDemandFromChild() {
            Line line = TestDataFactory.createLine("B1", "Bus 1", "#0000FF");
            Stop parent = parentStation("Hub");
            Stop platformA = platformOf(parent, "A", line);
            Stop platformB = platformOf(parent, "B", line);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(parent, platformA, platformB));
            when(scheduleRepository.findStopIdsWithOnDemandPickup()).thenReturn(Set.of(platformB.getId()));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.stops()).hasSize(1);
            assertThat(result.stops().get(0).hasOnDemand()).isTrue();
        }

        @Test
        @DisplayName("parent's own ACCESSIBLE flag wins over a NOT_ACCESSIBLE child")
        void parentAccessibleWinsOverNotAccessibleChild() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop parent = parentStation("Central");
            parent.setWheelchairBoarding(WheelchairAccess.ACCESSIBLE);
            Stop platform = platformOf(parent, "A", line);
            platform.setWheelchairBoarding(WheelchairAccess.NOT_ACCESSIBLE);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(parent, platform));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.stops().get(0).wheelchairBoarding())
                    .isEqualTo(WheelchairAccess.ACCESSIBLE);
        }

        @Test
        @DisplayName("a null-wheelchair parent inherits an ACCESSIBLE child so the filter doesn't hide partially-accessible stations")
        void nullParentInheritsAccessibleChild() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop parent = parentStation("Central");
            // parent.wheelchairBoarding stays null
            Stop platform = platformOf(parent, "A", line);
            platform.setWheelchairBoarding(WheelchairAccess.ACCESSIBLE);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(parent, platform));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.stops().get(0).wheelchairBoarding())
                    .isEqualTo(WheelchairAccess.ACCESSIBLE);
        }

        @Test
        @DisplayName("parent station fareAreaNames is the union of parent's own areas and each child's areas, sorted")
        void parentFareAreaNamesUnion() {
            Line line = TestDataFactory.createLine("M1", "Metro 1", "#FF0000");
            Stop parent = parentStation("Central");
            Stop platformA = platformOf(parent, "A", line);
            Stop platformB = platformOf(parent, "B", line);

            Area zone2 = Area.builder()
                    .id(UUID.randomUUID()).externalId("Z2").name("Zone 2")
                    .stops(new HashSet<>(Set.of(parent))).build();
            Area zone1 = Area.builder()
                    .id(UUID.randomUUID()).externalId("Z1").name("Zone 1")
                    .stops(new HashSet<>(Set.of(platformA))).build();
            Area zone3 = Area.builder()
                    .id(UUID.randomUUID()).externalId("Z3").name("Zone 3")
                    .stops(new HashSet<>(Set.of(platformB))).build();

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(parent, platformA, platformB));
            when(areaRepository.findAllWithStops()).thenReturn(List.of(zone1, zone2, zone3));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.stops()).hasSize(1);
            assertThat(result.stops().get(0).fareAreaNames())
                    .containsExactly("Zone 1", "Zone 2", "Zone 3");
        }

        @Test
        @DisplayName("free-standing stops without a parent stay as their own surface node and keep their own line codes")
        void freeStandingStopsRemainTheirOwnNode() {
            Line line = TestDataFactory.createLine("B1", "Bus 1", "#0000FF");
            Stop bus = TestDataFactory.createStop("Free Bus Pole", line);

            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of(line));
            when(stopRepository.findAllWithLines()).thenReturn(List.of(bus));

            NetworkMapResponse result = networkMapService.getNetworkMap();

            assertThat(result.stops()).hasSize(1);
            assertThat(result.stops().get(0).id()).isEqualTo(bus.getId());
            assertThat(result.stops().get(0).lineCodes()).containsExactly("B1");
        }
    }

    @Nested
    @DisplayName("Cache eviction")
    class CacheEviction {

        @Test
        @DisplayName("evicts caches and pushes FULL_UPDATE WebSocket payload on NetworkChangedEvent")
        void evictsCachesAndPushesOnNetworkChangedEvent() {
            Cache networkMapCache = mock(Cache.class);
            Cache networkAlertsCache = mock(Cache.class);
            when(cacheManager.getCache("networkMap")).thenReturn(networkMapCache);
            when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);
            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of());
            when(stopRepository.findAllWithLines()).thenReturn(List.of());
            when(broadcastMessageRepository.findActiveMessages(any(Instant.class))).thenReturn(List.of());
            when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(true);

            networkMapService.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));

            verify(networkMapCache).clear();
            verify(networkAlertsCache).clear();
            @SuppressWarnings("unchecked")
            ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSend(eq("/topic/network-map"), payloadCaptor.capture());
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) payloadCaptor.getValue();
            assertThat(payload).containsEntry("type", "FULL_UPDATE");
            assertThat(payload).containsKeys("networkMap", "alerts");
        }

        @Test
        @DisplayName("skips push when no map subscribers")
        void skipsPushWhenNoSubscribers() {
            Cache networkMapCache = mock(Cache.class);
            Cache networkAlertsCache = mock(Cache.class);
            when(cacheManager.getCache("networkMap")).thenReturn(networkMapCache);
            when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);
            when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(false);

            networkMapService.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));

            verify(networkMapCache).clear();
            verify(networkAlertsCache).clear();
            verify(messagingTemplate, never()).convertAndSend(eq("/topic/network-map"), any(Object.class));
        }

        @Test
        @DisplayName("evicts alerts cache and pushes ALERTS_UPDATE WebSocket payload on MessageChangedEvent")
        void evictsAlertsCacheAndPushesOnMessageChangedEvent() {
            Cache networkAlertsCache = mock(Cache.class);
            when(cacheManager.getCache("networkAlerts")).thenReturn(networkAlertsCache);
            when(broadcastMessageRepository.findActiveMessages(any(Instant.class))).thenReturn(List.of());
            when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(true);

            networkMapService.onMessageChanged(new MessageChangedEvent(this, Set.of()));

            verify(networkAlertsCache).clear();
            @SuppressWarnings("unchecked")
            ArgumentCaptor<Object> payloadCaptor = ArgumentCaptor.forClass(Object.class);
            verify(messagingTemplate).convertAndSend(eq("/topic/network-map"), payloadCaptor.capture());
            @SuppressWarnings("unchecked")
            Map<String, Object> payload = (Map<String, Object>) payloadCaptor.getValue();
            assertThat(payload).containsEntry("type", "ALERTS_UPDATE");
            assertThat(payload).containsKey("alerts");
            assertThat(payload).doesNotContainKey("networkMap");
        }

        @Test
        @DisplayName("handles null cache gracefully during eviction")
        void handlesNullCacheGracefully() {
            when(cacheManager.getCache("networkMap")).thenReturn(null);
            when(cacheManager.getCache("networkAlerts")).thenReturn(null);
            when(lineRepository.findAllWithItineraryStops()).thenReturn(List.of());
            when(stopRepository.findAllWithLines()).thenReturn(List.of());
            when(broadcastMessageRepository.findActiveMessages(any(Instant.class))).thenReturn(List.of());
            when(activeDisplayTracker.hasNetworkMapSubscribers()).thenReturn(true);

            // Should not throw
            networkMapService.onNetworkChanged(new NetworkChangedEvent(this, Set.of()));
        }
    }
}
