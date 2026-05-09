package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Location;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("LocationController Integration Tests")
class LocationControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private LocationRepository locationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String adminToken;

    @BeforeEach
    void setUp() {
        locationRepository.deleteAll();
        userRepository.deleteAll();
        User admin = User.builder()
                .username("admin").password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN).enabled(true).build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);
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
}
