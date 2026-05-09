package com.transit.hub.api.rest;

import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Location;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("NetworkMapController Integration Tests")
class NetworkMapControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private LineRepository lineRepository;
    @Autowired private StopRepository stopRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private BroadcastMessageRepository broadcastMessageRepository;
    @Autowired private LocationRepository locationRepository;
    @Autowired private CacheManager cacheManager;

    @BeforeEach
    void setUp() {
        broadcastMessageRepository.deleteAll();
        locationRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        userRepository.deleteAll();

        // Evict caches to prevent stale data from rolled-back transactions
        cacheManager.getCacheNames().forEach(name -> {
            var cache = cacheManager.getCache(name);
            if (cache != null) cache.clear();
        });

        Line testLine = Line.builder().code("L1").name("Metro Line 1").color("#FF5733").build();
        lineRepository.save(testLine);

        Stop testStop = Stop.builder().name("Central Station").lines(new HashSet<>(Set.of(testLine))).latitude(48.8).longitude(2.3).build();
        stopRepository.save(testStop);
    }

    private void evictAllCaches() {
        cacheManager.getCacheNames().forEach(name -> {
            var cache = cacheManager.getCache(name);
            if (cache != null) cache.clear();
        });
    }

    @Nested
    @DisplayName("GET /api/network-map")
    class GetNetworkMap {

        @Test
        @DisplayName("returns 200 without authentication (public)")
        void withoutAuth_Returns200() throws Exception {
            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", notNullValue()))
                    .andExpect(jsonPath("$.stops", notNullValue()))
                    .andExpect(jsonPath("$.bounds", notNullValue()));
        }

        @Test
        @DisplayName("returns correct structure with lines and stops")
        void returnsCorrectStructure() throws Exception {
            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", hasSize(greaterThanOrEqualTo(1))))
                    .andExpect(jsonPath("$.lines[0].code", is("L1")))
                    .andExpect(jsonPath("$.lines[0].name", is("Metro Line 1")))
                    .andExpect(jsonPath("$.lines[0].color", is("#FF5733")))
                    .andExpect(jsonPath("$.stops", hasSize(greaterThanOrEqualTo(1))))
                    .andExpect(jsonPath("$.stops[0].name", is("Central Station")));
        }

        @Test
        @DisplayName("returns multiple lines and stops when available")
        void withMultipleLinesAndStops_ReturnsAll() throws Exception {
            evictAllCaches();

            Line line2 = Line.builder().code("L2").name("Bus Line 2").color("#00FF00").build();
            lineRepository.save(line2);

            Stop stop2 = Stop.builder().name("North Station").lines(new HashSet<>(Set.of(line2))).latitude(48.9).longitude(2.4).build();
            stopRepository.save(stop2);

            Stop stop3 = Stop.builder().name("South Station").lines(new HashSet<>(Set.of(line2))).latitude(48.7).longitude(2.2).build();
            stopRepository.save(stop3);

            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", hasSize(2)))
                    .andExpect(jsonPath("$.lines[*].code", hasItems("L1", "L2")))
                    .andExpect(jsonPath("$.stops", hasSize(3)))
                    .andExpect(jsonPath("$.stops[*].name", hasItems("Central Station", "North Station", "South Station")));
        }

        @Test
        @DisplayName("calculates bounds from stop coordinates")
        void calculatesBoundsFromCoordinates() throws Exception {
            evictAllCaches();

            Stop stop2 = Stop.builder().name("North Station").lines(new HashSet<>()).latitude(49.0).longitude(3.0).build();
            stopRepository.save(stop2);

            Stop stop3 = Stop.builder().name("South Station").lines(new HashSet<>()).latitude(48.0).longitude(1.5).build();
            stopRepository.save(stop3);

            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.bounds").isMap())
                    .andExpect(jsonPath("$.bounds.minX").isNumber())
                    .andExpect(jsonPath("$.bounds.minY").isNumber())
                    .andExpect(jsonPath("$.bounds.maxX").isNumber())
                    .andExpect(jsonPath("$.bounds.maxY").isNumber())
                    // min longitude = 1.5, max longitude = 3.0, min latitude = 48.0, max latitude = 49.0
                    .andExpect(jsonPath("$.bounds.minX", is(1.5)))
                    .andExpect(jsonPath("$.bounds.minY", is(48.0)))
                    .andExpect(jsonPath("$.bounds.maxX", is(3.0)))
                    .andExpect(jsonPath("$.bounds.maxY", is(49.0)));
        }

        @Test
        @DisplayName("returns lineCodes on each stop")
        void returnsLineCodesOnStops() throws Exception {
            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stops[0].lineCodes").isArray())
                    .andExpect(jsonPath("$.stops[0].lineCodes", hasItem("L1")));
        }
    }

    @Nested
    @DisplayName("GET /api/network-map/alerts")
    class GetAlerts {

        @Test
        @DisplayName("returns 200 without authentication (public)")
        void withoutAuth_Returns200() throws Exception {
            mockMvc.perform(get("/api/network-map/alerts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.networkAlerts", notNullValue()))
                    .andExpect(jsonPath("$.lineAlerts", notNullValue()))
                    .andExpect(jsonPath("$.stopAlerts", notNullValue()));
        }

        @Test
        @DisplayName("returns alerts with correct structure")
        void returnsAlertsWithCorrectStructure() throws Exception {
            mockMvc.perform(get("/api/network-map/alerts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.networkAlerts").isArray())
                    .andExpect(jsonPath("$.lineAlerts").isMap())
                    .andExpect(jsonPath("$.stopAlerts").isMap());
        }

        @Test
        @DisplayName("returns empty alerts when no active messages exist")
        void withNoActiveMessages_ReturnsEmptyAlerts() throws Exception {
            evictAllCaches();

            mockMvc.perform(get("/api/network-map/alerts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.networkAlerts", hasSize(0)))
                    .andExpect(jsonPath("$.lineAlerts").isEmpty())
                    .andExpect(jsonPath("$.stopAlerts").isEmpty());
        }

        @Test
        @DisplayName("returns network alerts for active network-scoped messages")
        void withActiveNetworkMessage_ReturnsNetworkAlert() throws Exception {
            evictAllCaches();

            Instant now = Instant.now();
            BroadcastMessage networkMsg = BroadcastMessage.builder()
                    .title("Network Disruption")
                    .content("General strike affecting all lines")
                    .severity(MessageSeverity.CRITICAL)
                    .startTime(now.minus(1, ChronoUnit.HOURS))
                    .endTime(now.plus(1, ChronoUnit.HOURS))
                    .scopeType(MessageScope.NETWORK)
                    .build();
            broadcastMessageRepository.save(networkMsg);

            mockMvc.perform(get("/api/network-map/alerts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.networkAlerts", hasSize(1)))
                    .andExpect(jsonPath("$.networkAlerts[0].title", is("Network Disruption")))
                    .andExpect(jsonPath("$.networkAlerts[0].content", is("General strike affecting all lines")))
                    .andExpect(jsonPath("$.networkAlerts[0].severity", is("CRITICAL")));
        }

        @Test
        @DisplayName("does not return expired messages")
        void withExpiredMessage_DoesNotReturn() throws Exception {
            evictAllCaches();

            Instant now = Instant.now();
            BroadcastMessage expiredMsg = BroadcastMessage.builder()
                    .title("Expired Alert")
                    .content("This should not appear")
                    .severity(MessageSeverity.INFO)
                    .startTime(now.minus(3, ChronoUnit.HOURS))
                    .endTime(now.minus(1, ChronoUnit.HOURS))
                    .scopeType(MessageScope.NETWORK)
                    .build();
            broadcastMessageRepository.save(expiredMsg);

            mockMvc.perform(get("/api/network-map/alerts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.networkAlerts", hasSize(0)));
        }

        @Test
        @DisplayName("does not return future messages")
        void withFutureMessage_DoesNotReturn() throws Exception {
            evictAllCaches();

            Instant now = Instant.now();
            BroadcastMessage futureMsg = BroadcastMessage.builder()
                    .title("Future Alert")
                    .content("This should not appear yet")
                    .severity(MessageSeverity.WARNING)
                    .startTime(now.plus(1, ChronoUnit.HOURS))
                    .endTime(now.plus(3, ChronoUnit.HOURS))
                    .scopeType(MessageScope.NETWORK)
                    .build();
            broadcastMessageRepository.save(futureMsg);

            mockMvc.perform(get("/api/network-map/alerts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.networkAlerts", hasSize(0)));
        }

        @Test
        @DisplayName("categorizes line-scoped alerts under lineAlerts")
        void withLineMessage_ReturnsUnderLineAlerts() throws Exception {
            evictAllCaches();

            Line line = lineRepository.findAll().getFirst();
            Instant now = Instant.now();
            BroadcastMessage lineMsg = BroadcastMessage.builder()
                    .title("Line Delay")
                    .content("15-minute delay on this line")
                    .severity(MessageSeverity.WARNING)
                    .startTime(now.minus(1, ChronoUnit.HOURS))
                    .endTime(now.plus(1, ChronoUnit.HOURS))
                    .scopeType(MessageScope.LINE)
                    .scopeId(line.getId())
                    .build();
            broadcastMessageRepository.save(lineMsg);

            mockMvc.perform(get("/api/network-map/alerts"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.networkAlerts", hasSize(0)))
                    .andExpect(jsonPath("$.lineAlerts").isNotEmpty())
                    .andExpect(jsonPath("$.lineAlerts['" + line.getId() + "']", hasSize(1)))
                    .andExpect(jsonPath("$.lineAlerts['" + line.getId() + "'][0].title", is("Line Delay")));
        }
    }

    @Nested
    @DisplayName("GET /api/network-map - empty data")
    class GetNetworkMapEmpty {

        @Test
        @DisplayName("returns 200 with empty data when no lines/stops exist")
        void withNoData_Returns200() throws Exception {
            stopRepository.deleteAll();
            lineRepository.deleteAll();

            evictAllCaches();

            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", hasSize(0)))
                    .andExpect(jsonPath("$.stops", hasSize(0)));
        }

        @Test
        @DisplayName("returns default bounds when no stops exist")
        void withNoStops_ReturnsDefaultBounds() throws Exception {
            stopRepository.deleteAll();
            lineRepository.deleteAll();

            evictAllCaches();

            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.bounds.minX", is(0.0)))
                    .andExpect(jsonPath("$.bounds.minY", is(0.0)))
                    .andExpect(jsonPath("$.bounds.maxX", is(100.0)))
                    .andExpect(jsonPath("$.bounds.maxY", is(100.0)));
        }
    }

    @Nested
    @DisplayName("Cache behavior")
    class CacheBehavior {

        @Test
        @DisplayName("returns consistent data on repeated calls")
        void repeatedCalls_ReturnsConsistentData() throws Exception {
            // Call twice and verify the results are consistent
            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", hasSize(1)));

            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", hasSize(1)));
        }

        @Test
        @DisplayName("reflects new data after cache eviction")
        void afterCacheEviction_ReflectsNewData() throws Exception {
            // First call populates cache
            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", hasSize(1)));

            // Add new data
            Line line2 = Line.builder().code("L2").name("Bus Line 2").color("#00FF00").build();
            lineRepository.save(line2);

            // Evict cache
            evictAllCaches();

            // Second call should see new data
            mockMvc.perform(get("/api/network-map"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines", hasSize(2)));
        }
    }

    @Nested
    @DisplayName("GET /api/network-map/stops/{stopId}/tad-zone")
    class GetStopTadZone {

        @Test
        @DisplayName("returns 200 with the polygon when the stop has a flex location bound to it")
        void withBoundFlexLocation_Returns200() throws Exception {
            Stop stop = Stop.builder()
                    .name("Flex stop")
                    .externalId("EXT_FLEX_1")
                    .lines(new HashSet<>())
                    .latitude(45.19).longitude(5.72)
                    .build();
            stop = stopRepository.save(stop);

            Location loc = Location.builder()
                    .externalId("FLEX_NORTH")
                    .stopExternalId("EXT_FLEX_1")
                    .name("Zone Nord")
                    .geometryType("Polygon")
                    .geometryJson("{\"type\":\"Polygon\",\"coordinates\":[]}")
                    .minLatitude(45.18).maxLatitude(45.20)
                    .minLongitude(5.70).maxLongitude(5.75)
                    .build();
            locationRepository.save(loc);

            mockMvc.perform(get("/api/network-map/stops/" + stop.getId() + "/tad-zone"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.externalId", is("FLEX_NORTH")))
                    .andExpect(jsonPath("$.geometryType", is("Polygon")))
                    .andExpect(jsonPath("$.minLatitude", is(45.18)));
        }

        @Test
        @DisplayName("returns 404 when the stop has no flex location bound to it")
        void withoutFlexLocation_Returns404() throws Exception {
            Stop bareStop = Stop.builder()
                    .name("Plain stop")
                    .externalId("EXT_PLAIN")
                    .lines(new HashSet<>())
                    .latitude(45.0).longitude(5.0)
                    .build();
            bareStop = stopRepository.save(bareStop);

            mockMvc.perform(get("/api/network-map/stops/" + bareStop.getId() + "/tad-zone"))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 404 for an unknown stop id")
        void unknownStop_Returns404() throws Exception {
            mockMvc.perform(get("/api/network-map/stops/00000000-0000-0000-0000-000000000000/tad-zone"))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("public endpoint — no JWT required")
        void publicEndpoint() throws Exception {
            mockMvc.perform(get("/api/network-map/stops/00000000-0000-0000-0000-000000000000/tad-zone"))
                    .andExpect(status().isNotFound());  // not 401
        }
    }
}
