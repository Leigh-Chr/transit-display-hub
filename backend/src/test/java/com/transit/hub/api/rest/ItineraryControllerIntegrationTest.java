package com.transit.hub.api.rest;

import tools.jackson.databind.ObjectMapper;
import com.transit.hub.application.dto.request.AddItineraryStopRequest;
import com.transit.hub.application.dto.request.CreateItineraryRequest;
import com.transit.hub.application.dto.request.UpdateItineraryStopsRequest;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
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
@DisplayName("ItineraryController Integration Tests")
class ItineraryControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;
    @Autowired private ItineraryRepository itineraryRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private StopRepository stopRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;
    private String agentToken;
    private Line testLine;
    private Stop testStop;
    private Stop testStop2;
    private Itinerary testItinerary;

    @BeforeEach
    void setUp() {
        itineraryRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        userRepository.deleteAll();

        adminToken = authHelper.createAdminToken();

        agentToken = authHelper.createAgentToken();

        testLine = Line.builder().code("L1").name("Metro Line 1").color("#FF5733").build();
        lineRepository.save(testLine);

        testStop = Stop.builder().name("Central Station").lines(new HashSet<>(Set.of(testLine))).build();
        stopRepository.save(testStop);

        testStop2 = Stop.builder().name("North Park").lines(new HashSet<>(Set.of(testLine))).build();
        stopRepository.save(testStop2);

        testItinerary = Itinerary.builder().name("Direction North").line(testLine).build();
        itineraryRepository.save(testItinerary);
    }

    @Nested
    @DisplayName("GET /api/itineraries")
    class GetAllItineraries {

        @Test
        @DisplayName("returns 200 without authentication (public)")
        void withoutAuth_Returns200() throws Exception {
            mockMvc.perform(get("/api/itineraries"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)))
                    .andExpect(jsonPath("$[0].name", is("Direction North")));
        }

        @Test
        @DisplayName("filters by lineId")
        void withLineIdFilter_Returns200() throws Exception {
            mockMvc.perform(get("/api/itineraries")
                            .param("lineId", testLine.getId().toString()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$", hasSize(1)));
        }

        @Test
        @DisplayName("returns 404 for unknown lineId filter")
        void withUnknownLineId_Returns404() throws Exception {
            mockMvc.perform(get("/api/itineraries")
                            .param("lineId", UUID.randomUUID().toString()))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("GET /api/itineraries/{id}")
    class GetItinerary {

        @Test
        @DisplayName("returns 200 with itinerary for valid ID (public)")
        void withValidId_Returns200() throws Exception {
            mockMvc.perform(get("/api/itineraries/" + testItinerary.getId()))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name", is("Direction North")))
                    .andExpect(jsonPath("$.line.code", is("L1")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(get("/api/itineraries/" + UUID.randomUUID()))
                    .andExpect(status().isNotFound());
        }
    }

    @Nested
    @DisplayName("POST /api/itineraries")
    class CreateItinerary {

        @Test
        @DisplayName("returns 201 with created itinerary for ADMIN")
        void withAdminRole_Returns201() throws Exception {
            CreateItineraryRequest request = new CreateItineraryRequest(testLine.getId(), "Direction South", null);

            mockMvc.perform(post("/api/itineraries")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.name", is("Direction South")));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            CreateItineraryRequest request = new CreateItineraryRequest(testLine.getId(), "Direction South", null);

            mockMvc.perform(post("/api/itineraries").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 400 with validation errors")
        void withMissingName_Returns400() throws Exception {
            String json = "{\"lineId\": \"" + testLine.getId() + "\"}";

            mockMvc.perform(post("/api/itineraries")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(json))
                    .andExpect(status().isBadRequest());
        }
    }

    @Nested
    @DisplayName("PUT /api/itineraries/{id}")
    class UpdateItinerary {

        @Test
        @DisplayName("returns 200 with updated itinerary")
        void withValidRequest_Returns200() throws Exception {
            CreateItineraryRequest request = new CreateItineraryRequest(testLine.getId(), "Updated Name", null);

            mockMvc.perform(put("/api/itineraries/" + testItinerary.getId())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name", is("Updated Name")));
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            CreateItineraryRequest request = new CreateItineraryRequest(testLine.getId(), "Name", null);

            mockMvc.perform(put("/api/itineraries/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            CreateItineraryRequest request = new CreateItineraryRequest(testLine.getId(), "Name", null);

            mockMvc.perform(put("/api/itineraries/" + testItinerary.getId()).with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("DELETE /api/itineraries/{id}")
    class DeleteItinerary {

        @Test
        @DisplayName("returns 204 for successful deletion")
        void withValidId_Returns204() throws Exception {
            mockMvc.perform(delete("/api/itineraries/" + testItinerary.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNoContent());
        }

        @Test
        @DisplayName("returns 404 for non-existent ID")
        void withNonExistentId_Returns404() throws Exception {
            mockMvc.perform(delete("/api/itineraries/" + UUID.randomUUID())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isNotFound());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            mockMvc.perform(delete("/api/itineraries/" + testItinerary.getId()).with(csrf()))
                    .andExpect(status().isUnauthorized());
        }
    }

    @Nested
    @DisplayName("PUT /api/itineraries/{id}/stops")
    class UpdateItineraryStops {

        @Test
        @DisplayName("replaces stops on itinerary")
        void replacesStops() throws Exception {
            UpdateItineraryStopsRequest request = new UpdateItineraryStopsRequest(List.of(testStop.getId()));

            mockMvc.perform(put("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stops", hasSize(1)));
        }
    }

    @Nested
    @DisplayName("POST /api/itineraries/{id}/stops")
    class AddStopToItinerary {

        @Test
        @DisplayName("adds stop to itinerary")
        void addsStop() throws Exception {
            AddItineraryStopRequest request = new AddItineraryStopRequest(testStop.getId(), null);

            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.stops", hasSize(1)));
        }

        @Test
        @DisplayName("adds multiple stops in order")
        void addsMultipleStopsInOrder() throws Exception {
            // Add first stop
            AddItineraryStopRequest first = new AddItineraryStopRequest(testStop.getId(), null);
            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(first)))
                    .andExpect(status().isCreated());

            // Add second stop (appended at end by default)
            AddItineraryStopRequest second = new AddItineraryStopRequest(testStop2.getId(), null);
            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(second)))
                    .andExpect(status().isCreated())
                    .andExpect(jsonPath("$.stops", hasSize(2)))
                    .andExpect(jsonPath("$.stops[0].name", is("Central Station")))
                    .andExpect(jsonPath("$.stops[1].name", is("North Park")));
        }

        @Test
        @DisplayName("returns 400 when adding duplicate stop")
        void withDuplicateStop_Returns400() throws Exception {
            // Add stop first
            AddItineraryStopRequest request = new AddItineraryStopRequest(testStop.getId(), null);
            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isCreated());

            // Try to add same stop again
            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isBadRequest());
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            AddItineraryStopRequest request = new AddItineraryStopRequest(testStop.getId(), null);

            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops").with(csrf())
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isUnauthorized());
        }

        @Test
        @DisplayName("returns 403 for AGENT role")
        void withAgentRole_Returns403() throws Exception {
            AddItineraryStopRequest request = new AddItineraryStopRequest(testStop.getId(), null);

            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + agentToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(request)))
                    .andExpect(status().isForbidden());
        }
    }

    @Nested
    @DisplayName("DELETE /api/itineraries/{id}/stops/{stopId}")
    class RemoveStopFromItinerary {

        @Test
        @DisplayName("removes stop from itinerary")
        void removesStop() throws Exception {
            // First add a stop
            testItinerary.addStop(testStop, 0);
            itineraryRepository.save(testItinerary);

            mockMvc.perform(delete("/api/itineraries/" + testItinerary.getId() + "/stops/" + testStop.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stops", hasSize(0)));
        }

        @Test
        @DisplayName("removes last stop from multi-stop itinerary")
        void removesLastStopFromMultiStopItinerary() throws Exception {
            // Add two stops via API
            AddItineraryStopRequest first = new AddItineraryStopRequest(testStop.getId(), null);
            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(first)))
                    .andExpect(status().isCreated());

            AddItineraryStopRequest second = new AddItineraryStopRequest(testStop2.getId(), null);
            mockMvc.perform(post("/api/itineraries/" + testItinerary.getId() + "/stops")
                            .header("Authorization", "Bearer " + adminToken)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content(objectMapper.writeValueAsString(second)))
                    .andExpect(status().isCreated());

            // Remove the last stop (no reordering needed)
            mockMvc.perform(delete("/api/itineraries/" + testItinerary.getId() + "/stops/" + testStop2.getId())
                            .header("Authorization", "Bearer " + adminToken))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.stops", hasSize(1)))
                    .andExpect(jsonPath("$.stops[0].name", is("Central Station")));
        }

        @Test
        @DisplayName("returns 401 without authentication")
        void withoutAuth_Returns401() throws Exception {
            testItinerary.addStop(testStop, 0);
            itineraryRepository.save(testItinerary);

            mockMvc.perform(delete("/api/itineraries/" + testItinerary.getId() + "/stops/" + testStop.getId()).with(csrf()))
                    .andExpect(status().isUnauthorized());
        }
    }
}
