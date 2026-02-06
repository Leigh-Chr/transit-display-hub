package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.CreateStopRequest;
import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("StopController Integration Tests")
class StopControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private StopRepository stopRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private ItineraryRepository itineraryRepository;
    @Autowired private ScheduleRepository scheduleRepository;
    @Autowired private DeviceRepository deviceRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String adminToken;
    private String agentToken;
    private Line testLine;
    private Stop testStop;

    @BeforeEach
    void setUp() {
        scheduleRepository.deleteAll();
        deviceRepository.deleteAll();
        itineraryRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        userRepository.deleteAll();

        User admin = User.builder().username("admin").password(passwordEncoder.encode("admin123")).role(UserRole.ADMIN).enabled(true).build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);

        User agent = User.builder().username("agent").password(passwordEncoder.encode("agent123")).role(UserRole.AGENT).enabled(true).build();
        userRepository.save(agent);
        agentToken = jwtService.generateToken(agent);

        testLine = Line.builder().code("L1").name("Metro Line 1").color("#FF5733").build();
        lineRepository.save(testLine);

        testStop = Stop.builder().name("Central Station").lines(new HashSet<>(Set.of(testLine))).build();
        stopRepository.save(testStop);
    }

    @Nested
    @DisplayName("GET /api/stops")
    class GetAllStops {

        @Test
        @DisplayName("returns 200 with all stops for ADMIN")
        void withAdminRole_Returns200() throws Exception {
            mockMvc.perform(get("/api/stops")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].name", is("Central Station")));
        }

        @Test
        @DisplayName("returns 403 without authentication")
        void withoutAuth_Returns403() throws Exception {
            mockMvc.perform(get("/api/stops"))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("GET /api/stops (paginated)")
    class GetAllStopsPaginated {

        @Test
        @DisplayName("returns paginated results with search")
        void withPaginationAndSearch_Returns200() throws Exception {
            mockMvc.perform(get("/api/stops")
                            .param("page", "0")
                            .param("search", "Central")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].name", is("Central Station")));
        }

        @Test
        @DisplayName("filters by lineId")
        void withLineIdFilter_Returns200() throws Exception {
            mockMvc.perform(get("/api/stops")
                            .param("lineId", testLine.getId().toString())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)));
        }
    }

    @Nested
    @DisplayName("GET /api/stops/{id}")
    class GetStop {

        @Test
        @DisplayName("returns 200 with stop for valid ID")
        void withValidId_Returns200() throws Exception {
            mockMvc.perform(get("/api/stops/" + testStop.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name", is("Central Station")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(get("/api/stops/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/stops")
    class CreateStop {

        @Test
        @DisplayName("returns 201 with created stop for ADMIN")
        void withAdminRole_Returns201() throws Exception {
            CreateStopRequest request = new CreateStopRequest("North Station", Set.of(testLine.getId()), 48.8, 2.3);

            mockMvc.perform(post("/api/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.name", is("North Station")));
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            CreateStopRequest request = new CreateStopRequest("North Station", Set.of(testLine.getId()), null, null);

            mockMvc.perform(post("/api/stops")
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("returns 400 with blank name")
        void withBlankName_Returns400() throws Exception {
            String json = "{\"name\": \"\", \"lineIds\": [\"" + testLine.getId() + "\"]}";

            mockMvc.perform(post("/api/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with empty lineIds")
        void withEmptyLineIds_Returns400() throws Exception {
            String json = "{\"name\": \"Test Stop\", \"lineIds\": []}";

            mockMvc.perform(post("/api/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 404 with non-existent lineId")
        void withNonExistentLineId_Returns404() throws Exception {
            UUID fakeLineId = UUID.randomUUID();
            CreateStopRequest request = new CreateStopRequest("Ghost Stop", Set.of(fakeLineId), null, null);

            mockMvc.perform(post("/api/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("PUT /api/stops/{id}")
    class UpdateStop {

        @Test
        @DisplayName("returns 200 with updated stop")
        void withValidRequest_Returns200() throws Exception {
            CreateStopRequest request = new CreateStopRequest("Updated Station", Set.of(testLine.getId()), 48.9, 2.4);

            mockMvc.perform(put("/api/stops/" + testStop.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name", is("Updated Station")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            CreateStopRequest request = new CreateStopRequest("Test", Set.of(testLine.getId()), null, null);

            mockMvc.perform(put("/api/stops/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("DELETE /api/stops/{id}")
    class DeleteStop {

        @Test
        @DisplayName("returns 204 for successful deletion")
        void withValidId_Returns204() throws Exception {
            mockMvc.perform(delete("/api/stops/" + testStop.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(delete("/api/stops/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 403 without authentication")
        void withoutAuth_Returns403() throws Exception {
            mockMvc.perform(delete("/api/stops/" + testStop.getId()))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("cascading deletion cleans up schedules and devices")
        void cascadingDeletion_CleansUpRelatedEntities() throws Exception {
            Itinerary itinerary = Itinerary.builder().name("Direction North").line(testLine).build();
            itineraryRepository.save(itinerary);

            Schedule schedule = Schedule.builder().time(LocalTime.of(9, 0)).stop(testStop).itinerary(itinerary).build();
            scheduleRepository.save(schedule);

            Device device = Device.builder()
                    .tokenLookup("abcd1234")
                    .tokenHash("$2a$10$fakehashfakehashfakehashfakehashfakehashfakehashfa")
                    .stop(testStop)
                    .status(DeviceStatus.OFFLINE)
                    .build();
            deviceRepository.save(device);

            mockMvc.perform(delete("/api/stops/" + testStop.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());

            assertThat(stopRepository.findById(testStop.getId())).isEmpty();
            assertThat(scheduleRepository.findById(schedule.getId())).isEmpty();
            assertThat(deviceRepository.findById(device.getId())).isEmpty();
        }
    }

    @Nested
    @DisplayName("GET /api/stops with search")
    class GetStopsWithSearch {

        @Test
        @DisplayName("returns filtered results matching search term")
        void withSearch_ReturnsMatchingStops() throws Exception {
            Stop otherStop = Stop.builder().name("North Park").lines(new HashSet<>(Set.of(testLine))).build();
            stopRepository.save(otherStop);

            mockMvc.perform(get("/api/stops")
                            .param("page", "0")
                            .param("size", "10")
                            .param("search", "Central")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].name", is("Central Station")));
        }

        @Test
        @DisplayName("returns stops filtered by lineId with pagination")
        void withLineIdAndPagination_ReturnsFilteredStops() throws Exception {
            Line otherLine = Line.builder().code("L2").name("Bus Line 2").color("#00FF00").build();
            lineRepository.save(otherLine);

            Stop otherStop = Stop.builder().name("Other Stop").lines(new HashSet<>(Set.of(otherLine))).build();
            stopRepository.save(otherStop);

            mockMvc.perform(get("/api/stops")
                            .param("page", "0")
                            .param("size", "10")
                            .param("lineId", testLine.getId().toString())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].name", is("Central Station")));
        }
    }
}
