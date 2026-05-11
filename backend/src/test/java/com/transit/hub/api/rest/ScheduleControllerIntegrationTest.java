package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.CreateScheduleRequest;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.*;
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

import static org.hamcrest.Matchers.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("ScheduleController Integration Tests")
class ScheduleControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ScheduleRepository scheduleRepository;
    @Autowired private ItineraryRepository itineraryRepository;
    @Autowired private StopRepository stopRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String adminToken;
    private Line testLine;
    private Stop testStop;
    private Itinerary testItinerary;
    private Schedule testSchedule;

    @BeforeEach
    void setUp() {
        scheduleRepository.deleteAll();
        itineraryRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        userRepository.deleteAll();

        User admin = User.builder().username("admin").password(passwordEncoder.encode("admin123")).role(UserRole.ADMIN).enabled(true).build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);

        testLine = Line.builder().code("L1").name("Metro Line 1").color("#FF5733").build();
        lineRepository.save(testLine);

        testStop = Stop.builder().name("Central Station").lines(new HashSet<>(Set.of(testLine))).build();
        stopRepository.save(testStop);

        testItinerary = Itinerary.builder().name("Direction North").line(testLine).build();
        testItinerary.addStop(testStop, 0);
        itineraryRepository.save(testItinerary);

        testSchedule = Schedule.builder().time(LocalTime.of(8, 30)).stop(testStop).itinerary(testItinerary).build();
        scheduleRepository.save(testSchedule);
    }

    @Nested
    @DisplayName("GET /api/stops/{stopId}/schedules")
    class GetScheduleForStop {

        @Test
        @DisplayName("returns 200 without authentication (public)")
        void withoutAuth_Returns200() throws Exception {
            mockMvc.perform(get("/api/stops/" + testStop.getId() + "/schedules"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].time", is("08:30:00")));
        }

        @Test
        @DisplayName("returns empty list for stop without schedules")
        void forStopWithNoSchedules_ReturnsEmpty() throws Exception {
            Stop emptyStop = Stop.builder().name("Empty Stop").lines(new HashSet<>(Set.of(testLine))).build();
            stopRepository.save(emptyStop);

            mockMvc.perform(get("/api/stops/" + emptyStop.getId() + "/schedules"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(0)));
        }
    }

    @Nested
    @DisplayName("POST /api/stops/{stopId}/schedules")
    class CreateSchedule {

        @Test
        @DisplayName("returns 201 with created schedule for ADMIN")
        void withAdminRole_Returns201() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("14:30", testItinerary.getId());

            mockMvc.perform(post("/api/stops/" + testStop.getId() + "/schedules")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.time", is("14:30:00")));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("14:30", testItinerary.getId());

            mockMvc.perform(post("/api/stops/" + testStop.getId() + "/schedules").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 400 with invalid time format")
        void withInvalidTimeFormat_Returns400() throws Exception {
            String json = "{\"time\": \"25:00\", \"itineraryId\": \"" + testItinerary.getId() + "\"}";

            mockMvc.perform(post("/api/stops/" + testStop.getId() + "/schedules")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with missing itineraryId")
        void withMissingItineraryId_Returns400() throws Exception {
            String json = "{\"time\": \"14:30\"}";

            mockMvc.perform(post("/api/stops/" + testStop.getId() + "/schedules")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("POST /api/stops/{stopId}/schedules - edge cases")
    class CreateScheduleEdgeCases {

        @Test
        @DisplayName("returns error when itinerary's line is not on the stop")
        void withItineraryLineNotOnStop_ReturnsError() throws Exception {
            Line otherLine = Line.builder().code("L2").name("Other Line").color("#00FF00").build();
            lineRepository.save(otherLine);

            Itinerary otherItinerary = Itinerary.builder().name("Other Direction").line(otherLine).build();
            itineraryRepository.save(otherItinerary);

            CreateScheduleRequest request = new CreateScheduleRequest("10:00", otherItinerary.getId());

            mockMvc.perform(post("/api/stops/" + testStop.getId() + "/schedules")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns error when creating duplicate schedule (same stop/itinerary/time)")
        void withDuplicateSchedule_ReturnsError() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("08:30", testItinerary.getId());

            mockMvc.perform(post("/api/stops/" + testStop.getId() + "/schedules")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 404 for non-existent stopId")
        void withNonExistentStopId_Returns404() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", testItinerary.getId());

            mockMvc.perform(post("/api/stops/" + UUID.randomUUID() + "/schedules")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 404 for non-existent itineraryId")
        void withNonExistentItineraryId_Returns404() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", UUID.randomUUID());

            mockMvc.perform(post("/api/stops/" + testStop.getId() + "/schedules")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("PUT /api/schedules/{id}")
    class UpdateSchedule {

        @Test
        @DisplayName("returns 200 with updated schedule")
        void withValidRequest_Returns200() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("16:00", testItinerary.getId());

            mockMvc.perform(put("/api/schedules/" + testSchedule.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.time", is("16:00:00")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("16:00", testItinerary.getId());

            mockMvc.perform(put("/api/schedules/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("16:00", testItinerary.getId());

            mockMvc.perform(put("/api/schedules/" + testSchedule.getId()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("correctly updates schedule time")
        void updatesTime_ReflectedInResponse() throws Exception {
            CreateScheduleRequest request = new CreateScheduleRequest("18:45", testItinerary.getId());

            mockMvc.perform(put("/api/schedules/" + testSchedule.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.time", is("18:45:00")));

            // Verify the update persisted by fetching schedules for the stop
            mockMvc.perform(get("/api/stops/" + testStop.getId() + "/schedules"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[0].time", is("18:45:00")));
        }
    }

    @Nested
    @DisplayName("DELETE /api/schedules/{id}")
    class DeleteSchedule {

        @Test
        @DisplayName("returns 204 for successful deletion")
        void withValidId_Returns204() throws Exception {
            mockMvc.perform(delete("/api/schedules/" + testSchedule.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(delete("/api/schedules/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(delete("/api/schedules/" + testSchedule.getId()).with(csrf()))
                    .andExpect(status().isUnauthorized());
        }
    }
}
