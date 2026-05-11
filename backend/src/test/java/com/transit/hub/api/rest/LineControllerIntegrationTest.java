package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.request.CreateScheduleRequest;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.UserRole;
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
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("LineController Integration Tests")
class LineControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private LineRepository lineRepository;

    @Autowired
    private StopRepository stopRepository;

    @Autowired
    private ItineraryRepository itineraryRepository;

    @Autowired
    private ScheduleRepository scheduleRepository;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private JwtService jwtService;

    private String adminToken;
    private String agentToken;
    private Line testLine;

    @BeforeEach
    void setUp() {
        scheduleRepository.deleteAll();
        itineraryRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        userRepository.deleteAll();

        User admin = User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);

        User agent = User.builder()
                .username("agent")
                .password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build();
        userRepository.save(agent);
        agentToken = jwtService.generateToken(agent);

        testLine = Line.builder()
                .code("L1")
                .name("Metro Line 1")
                .color("#FF5733")
                .build();
        lineRepository.save(testLine);
    }

    @Nested
    @DisplayName("GET /api/lines")
    class GetAllLines {

        @Test
        @DisplayName("returns 200 with all lines for ADMIN")
        void withAdminRole_Returns200() throws Exception {
            mockMvc.perform(get("/api/lines")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].code", is("L1")))
                    .andExpect(jsonPath("$[0].name", is("Metro Line 1")))
                    .andExpect(jsonPath("$[0].color", is("#FF5733")));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(get("/api/lines"))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 200 for AGENT role")
        void withAgentRole_Returns200() throws Exception {
            mockMvc.perform(get("/api/lines")
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isOk());
        }

        @Test
        @DisplayName("returns paginated results with page params")
        void withPaginationParams_ReturnsPaginatedResponse() throws Exception {
            Line line2 = Line.builder().code("L2").name("Metro Line 2").color("#00FF00").build();
            lineRepository.save(line2);

            mockMvc.perform(get("/api/lines")
                            .param("page", "0")
                            .param("size", "1")
                            .param("sortBy", "code")
                            .param("sortDir", "asc")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].code", is("L1")))
                    .andExpect(jsonPath("$.totalElements", is(2)))
                    .andExpect(jsonPath("$.totalPages", is(2)));
        }

        @Test
        @DisplayName("returns paginated results sorted descending")
        void withDescSort_ReturnsSortedDescending() throws Exception {
            Line line2 = Line.builder().code("L2").name("Metro Line 2").color("#00FF00").build();
            lineRepository.save(line2);

            mockMvc.perform(get("/api/lines")
                            .param("page", "0")
                            .param("size", "10")
                            .param("sortDir", "desc")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content[0].code", is("L2")));
        }

        @Test
        @DisplayName("returns filtered results with search parameter")
        void withSearch_ReturnsMatchingLines() throws Exception {
            Line line2 = Line.builder().code("BUS1").name("Bus Route 1").color("#00FF00").build();
            lineRepository.save(line2);

            mockMvc.perform(get("/api/lines")
                            .param("page", "0")
                            .param("size", "10")
                            .param("search", "Metro")
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.content", hasSize(1)))
                    .andExpect(jsonPath("$.content[0].name", is("Metro Line 1")));
        }
    }

    @Nested
    @DisplayName("GET /api/lines/{id}")
    class GetLine {

        @Test
        @DisplayName("returns 200 with line for valid ID")
        void withValidId_Returns200() throws Exception {
            mockMvc.perform(get("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.id", is(testLine.getId().toString())))
                    .andExpect(jsonPath("$.code", is("L1")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(get("/api/lines/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/lines")
    class CreateLine {

        @Test
        @DisplayName("returns 201 with created line for ADMIN")
        void withAdminRole_Returns201() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L2", "New Line", "#00FF00", LineType.METRO);

            mockMvc.perform(post("/api/lines")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.id", notNullValue()))
                    .andExpect(jsonPath("$.code", is("L2")))
                    .andExpect(jsonPath("$.name", is("New Line")))
                    .andExpect(jsonPath("$.color", is("#00FF00")));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L2", "New Line", "#00FF00", LineType.METRO);

            mockMvc.perform(post("/api/lines").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L2", "New Line", "#00FF00", LineType.METRO);

            mockMvc.perform(post("/api/lines")
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("returns 400 for duplicate code")
        void withDuplicateCode_Returns400() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L1", "Duplicate", "#00FF00", LineType.METRO);

            mockMvc.perform(post("/api/lines")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with blank code")
        void withBlankCode_Returns400() throws Exception {
            String json = "{\"code\": \"\", \"name\": \"Line\", \"color\": \"#FF0000\"}";

            mockMvc.perform(post("/api/lines")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with invalid color format")
        void withInvalidColor_Returns400() throws Exception {
            String json = "{\"code\": \"L2\", \"name\": \"Line\", \"color\": \"red\"}";

            mockMvc.perform(post("/api/lines")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 400 with code exceeding max length")
        void withCodeTooLong_Returns400() throws Exception {
            String json = "{\"code\": \"12345678901\", \"name\": \"Line\", \"color\": \"#FF0000\"}";

            mockMvc.perform(post("/api/lines")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("PUT /api/lines/{id}")
    class UpdateLine {

        @Test
        @DisplayName("returns 200 with updated line for ADMIN")
        void withAdminRole_Returns200() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L1-NEW", "Updated Line", "#0000FF", LineType.METRO);

            mockMvc.perform(put("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code", is("L1-NEW")))
                    .andExpect(jsonPath("$.name", is("Updated Line")))
                    .andExpect(jsonPath("$.color", is("#0000FF")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L1", "Line", "#FF0000", LineType.METRO);

            mockMvc.perform(put("/api/lines/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("succeeds when keeping same code")
        void keepingSameCode_Succeeds() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L1", "Updated Name", "#0000FF", LineType.METRO);

            mockMvc.perform(put("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.code", is("L1")))
                    .andExpect(jsonPath("$.name", is("Updated Name")));
        }

        @Test
        @DisplayName("returns 400 when updating code to existing code from another line")
        void withDuplicateCodeFromAnotherLine_Returns400() throws Exception {
            Line otherLine = Line.builder().code("L2").name("Other Line").color("#00FF00").build();
            lineRepository.save(otherLine);

            CreateLineRequest request = new CreateLineRequest("L2", "Trying Duplicate", "#FF0000", LineType.METRO);

            mockMvc.perform(put("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            CreateLineRequest request = new CreateLineRequest("L1-NEW", "Updated", "#0000FF", LineType.METRO);

            mockMvc.perform(put("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("DELETE /api/lines/{id}")
    class DeleteLine {

        @Test
        @DisplayName("returns 204 for successful deletion")
        void withValidId_Returns204() throws Exception {
            mockMvc.perform(delete("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(delete("/api/lines/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(delete("/api/lines/" + testLine.getId()).with(csrf()))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            mockMvc.perform(delete("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + agentToken))
                    .andExpect(status().isForbidden());
        }

        @Test
        @DisplayName("cascading deletion cleans up stops association, itineraries, and schedules")
        void cascadingDeletion_CleansUpRelatedEntities() throws Exception {
            Stop stop = Stop.builder().name("Station A").lines(new HashSet<>(Set.of(testLine))).build();
            stopRepository.save(stop);

            Itinerary itinerary = Itinerary.builder().name("Direction North").line(testLine).build();
            itineraryRepository.save(itinerary);

            Schedule schedule = Schedule.builder().time(LocalTime.of(10, 0)).stop(stop).itinerary(itinerary).build();
            scheduleRepository.save(schedule);

            mockMvc.perform(delete("/api/lines/" + testLine.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());

            assertThat(lineRepository.findById(testLine.getId())).isEmpty();
            assertThat(itineraryRepository.findById(itinerary.getId())).isEmpty();
            assertThat(scheduleRepository.findById(schedule.getId())).isEmpty();
            // Stop itself should still exist (many-to-many, not cascaded)
            assertThat(stopRepository.findById(stop.getId())).isPresent();
        }
    }
}
