package com.transit.hub.api.rest;

import com.transit.hub.domain.model.*;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.*;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("DisplayController Integration Tests")
class DisplayControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private StopRepository stopRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private ItineraryRepository itineraryRepository;
    @Autowired private ScheduleRepository scheduleRepository;
    @Autowired private BroadcastMessageRepository broadcastMessageRepository;
    @Autowired private DeviceRepository deviceRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private Line testLine;
    private Stop testStop;
    private String plainDeviceToken = "test_device_token_display";

    @BeforeEach
    void setUp() {
        deviceRepository.deleteAll();
        broadcastMessageRepository.deleteAll();
        scheduleRepository.deleteAll();
        itineraryRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        userRepository.deleteAll();

        testLine = Line.builder().code("L1").name("Metro Line 1").color("#FF5733").build();
        lineRepository.save(testLine);

        testStop = Stop.builder().name("Central Station").lines(new HashSet<>(Set.of(testLine))).build();
        stopRepository.save(testStop);

        Device device = Device.builder()
                .tokenLookup(plainDeviceToken.substring(0, 8))
                .tokenHash(passwordEncoder.encode(plainDeviceToken))
                .stop(testStop)
                .status(DeviceStatus.OFFLINE)
                .build();
        deviceRepository.save(device);
    }

    @Nested
    @DisplayName("GET /api/display/{stopId}")
    class GetDisplayState {

        @Test
        @DisplayName("returns 200 without authentication (public endpoint)")
        void withoutAuth_Returns200() throws Exception {
            mockMvc.perform(get("/api/display/" + testStop.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stopId", is(testStop.getId().toString())))
                    .andExpect(jsonPath("$.stopName", is("Central Station")))
                    .andExpect(jsonPath("$.arrivals", notNullValue()))
                    .andExpect(jsonPath("$.messages", notNullValue()))
                    .andExpect(jsonPath("$.version", notNullValue()))
                    .andExpect(jsonPath("$.generatedAt", notNullValue()));
        }

        @Test
        @DisplayName("returns 404 for non-existent stop")
        void withNonExistentStop_Returns404() throws Exception {
            mockMvc.perform(get("/api/display/" + UUID.randomUUID()))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 400 for an invalid UUID path variable")
        void withInvalidUuid_Returns400() throws Exception {
            // The GlobalExceptionHandler maps Spring's
            // MethodArgumentTypeMismatchException to 400 — a malformed
            // UUID is a client mistake, not a server bug.
            mockMvc.perform(get("/api/display/not-a-valid-uuid"))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns display state with correct field structure")
        void returnsDisplayStateStructure() throws Exception {
            mockMvc.perform(get("/api/display/" + testStop.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stopId", is(testStop.getId().toString())))
                    .andExpect(jsonPath("$.stopName", is("Central Station")))
                    .andExpect(jsonPath("$.lines", notNullValue()))
                    .andExpect(jsonPath("$.arrivals").isArray())
                    .andExpect(jsonPath("$.messages").isArray())
                    .andExpect(jsonPath("$.version").isNumber())
                    .andExpect(jsonPath("$.generatedAt").isString());
        }

        @Test
        @DisplayName("is accessible with authentication too")
        void withAuth_StillReturns200() throws Exception {
            mockMvc.perform(get("/api/display/" + testStop.getId()))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("returns empty arrivals for stop with no schedules")
        void withNoSchedules_ReturnsEmptyArrivals() throws Exception {
            mockMvc.perform(get("/api/display/" + testStop.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.arrivals").isArray())
                    .andExpect(jsonPath("$.arrivals", hasSize(0)));
        }

        @Test
        @DisplayName("returns active messages for stop with broadcast messages")
        void withActiveMessages_ReturnsMessages() throws Exception {
            Instant now = Instant.now();
            BroadcastMessage networkMessage = BroadcastMessage.builder()
                    .title("Network Alert")
                    .content("Service disruption across the network")
                    .severity(MessageSeverity.WARNING)
                    .startTime(now.minus(1, ChronoUnit.HOURS))
                    .endTime(now.plus(1, ChronoUnit.HOURS))
                    .scopeType(MessageScope.NETWORK)
                    .build();
            broadcastMessageRepository.save(networkMessage);

            BroadcastMessage stopMessage = BroadcastMessage.builder()
                    .title("Stop Alert")
                    .content("Elevator out of service at this stop")
                    .severity(MessageSeverity.INFO)
                    .startTime(now.minus(1, ChronoUnit.HOURS))
                    .endTime(now.plus(1, ChronoUnit.HOURS))
                    .scopeType(MessageScope.STOP)
                    .scopeId(testStop.getId())
                    .build();
            broadcastMessageRepository.save(stopMessage);

            mockMvc.perform(get("/api/display/" + testStop.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.messages").isArray())
                    .andExpect(jsonPath("$.messages", hasSize(greaterThanOrEqualTo(2))))
                    .andExpect(jsonPath("$.messages[*].title", hasItems("Network Alert", "Stop Alert")))
                    .andExpect(jsonPath("$.messages[*].content", hasItems(
                            "Service disruption across the network",
                            "Elevator out of service at this stop"
                    )));
        }

        @Test
        @DisplayName("returns correct stop name in response")
        void returnsCorrectStopName() throws Exception {
            Stop anotherStop = Stop.builder()
                    .name("Gare du Nord")
                    .lines(new HashSet<>(Set.of(testLine)))
                    .build();
            stopRepository.save(anotherStop);

            mockMvc.perform(get("/api/display/" + anotherStop.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stopName", is("Gare du Nord")))
                    .andExpect(jsonPath("$.stopId", is(anotherStop.getId().toString())));
        }

        @Test
        @DisplayName("returns line info associated with the stop")
        void returnsLineInfo() throws Exception {
            mockMvc.perform(get("/api/display/" + testStop.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.lines").isArray())
                    .andExpect(jsonPath("$.lines", hasSize(1)))
                    .andExpect(jsonPath("$.lines[0].code", is("L1")))
                    .andExpect(jsonPath("$.lines[0].name", is("Metro Line 1")))
                    .andExpect(jsonPath("$.lines[0].color", is("#FF5733")));
        }
    }

    @Nested
    @DisplayName("GET /api/display (with X-Device-Token)")
    class GetDisplayStateByToken {

        @Test
        @DisplayName("returns 200 with display state for valid device token")
        void withValidToken_Returns200() throws Exception {
            mockMvc.perform(get("/api/display")
                            .header("X-Device-Token", plainDeviceToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stopId", is(testStop.getId().toString())))
                    .andExpect(jsonPath("$.stopName", is("Central Station")))
                    .andExpect(jsonPath("$.arrivals", notNullValue()))
                    .andExpect(jsonPath("$.messages", notNullValue()));
        }

        @Test
        @DisplayName("returns 401 for invalid device token")
        void withInvalidToken_Returns401() throws Exception {
            mockMvc.perform(get("/api/display")
                            .header("X-Device-Token", "invalid_token_value"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns error when X-Device-Token header is missing")
        void withoutToken_ReturnsError() throws Exception {
            mockMvc.perform(get("/api/display"))
                    .andExpect(status().is5xxServerError());
        }
    }
}
