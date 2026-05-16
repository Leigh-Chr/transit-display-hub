package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Location;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("LocationController Integration Tests")
class LocationControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private LocationRepository locationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;

    @BeforeEach
    void setUp() {
        locationRepository.deleteAll();
        userRepository.deleteAll();
        adminToken = authHelper.createAdminToken();
    }

    @Test
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/locations"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("admin gets the empty list when no locations have been imported")
    void adminEmpty() throws Exception {
        mockMvc.perform(get("/api/admin/locations").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("admin gets each persisted location with its bounding box and geometry")
    void adminGetsLocations() throws Exception {
        locationRepository.save(Location.builder()
                .externalId("LOC-1").stopExternalId("STOP-FLEX-1").name("Zone TAD nord")
                .geometryType("Polygon")
                .geometryJson("{\"type\":\"Polygon\",\"coordinates\":[[[5.7,45.18],[5.75,45.18],[5.75,45.20],[5.7,45.20],[5.7,45.18]]]}")
                .minLatitude(45.18).minLongitude(5.7).maxLatitude(45.20).maxLongitude(5.75)
                .build());

        mockMvc.perform(get("/api/admin/locations").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("LOC-1")))
                .andExpect(jsonPath("$[0].stopExternalId", is("STOP-FLEX-1")))
                .andExpect(jsonPath("$[0].name", is("Zone TAD nord")))
                .andExpect(jsonPath("$[0].geometryType", is("Polygon")))
                .andExpect(jsonPath("$[0].minLatitude", is(45.18)))
                .andExpect(jsonPath("$[0].maxLongitude", is(5.75)));
    }

    @Test
    @DisplayName("contains: anonymous gets 401")
    void containsRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/locations/contains")
                        .param("lat", "45.19").param("lon", "5.72"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("contains: returns the polygon when the point is inside")
    void containsReturnsMatch() throws Exception {
        locationRepository.save(Location.builder()
                .externalId("LOC-1").stopExternalId("STOP-FLEX-1").name("Zone TAD nord")
                .geometryType("Polygon")
                .geometryJson("{\"type\":\"Polygon\",\"coordinates\":[[[5.7,45.18],[5.75,45.18],[5.75,45.20],[5.7,45.20],[5.7,45.18]]]}")
                .minLatitude(45.18).minLongitude(5.7).maxLatitude(45.20).maxLongitude(5.75)
                .build());

        mockMvc.perform(get("/api/admin/locations/contains")
                        .param("lat", "45.19").param("lon", "5.72")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("LOC-1")));
    }

    @Test
    @DisplayName("contains: returns empty list when the point is outside the bounding box")
    void containsReturnsEmptyOutsideBbox() throws Exception {
        locationRepository.save(Location.builder()
                .externalId("LOC-1").stopExternalId("STOP-FLEX-1").name("Zone TAD nord")
                .geometryType("Polygon")
                .geometryJson("{\"type\":\"Polygon\",\"coordinates\":[[[5.7,45.18],[5.75,45.18],[5.75,45.20],[5.7,45.20],[5.7,45.18]]]}")
                .minLatitude(45.18).minLongitude(5.7).maxLatitude(45.20).maxLongitude(5.75)
                .build());

        // Far enough away that the SQL bbox pre-filter rejects it.
        mockMvc.perform(get("/api/admin/locations/contains")
                        .param("lat", "48.85").param("lon", "2.35")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("contains: bbox covers point but Java ray-cast rejects (L-shaped polygon)")
    void containsBboxLooseButPolygonStrict() throws Exception {
        // Triangle in the south-west corner of a 0..10 bbox.
        // The point (8, 8) is inside the bbox but outside the triangle.
        locationRepository.save(Location.builder()
                .externalId("LOC-TRI").stopExternalId(null).name("Triangle")
                .geometryType("Polygon")
                .geometryJson("{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[10,0],[0,10],[0,0]]]}")
                .minLatitude(0.0).minLongitude(0.0).maxLatitude(10.0).maxLongitude(10.0)
                .build());

        mockMvc.perform(get("/api/admin/locations/contains")
                        .param("lat", "8").param("lon", "8")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));

        // Point inside the triangle is returned.
        mockMvc.perform(get("/api/admin/locations/contains")
                        .param("lat", "1").param("lon", "1")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("LOC-TRI")));
    }
}
