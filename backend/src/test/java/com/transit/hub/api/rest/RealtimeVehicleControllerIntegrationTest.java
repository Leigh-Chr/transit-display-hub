package com.transit.hub.api.rest;

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
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("RealtimeVehicleController Integration Tests")
class RealtimeVehicleControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        adminToken = authHelper.createAdminToken();
    }

    @Test
    @DisplayName("GET requires authentication")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/realtime/vehicles"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("admin GET returns the empty snapshot when the feed is disabled")
    void adminGetSnapshot() throws Exception {
        mockMvc.perform(get("/api/admin/realtime/vehicles").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("POST /refresh returns 400 when no upstream URL is configured")
    void refreshDisabled() throws Exception {
        mockMvc.perform(post("/api/admin/realtime/vehicles/refresh")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /refresh requires authentication")
    void refreshRequiresAuth() throws Exception {
        mockMvc.perform(post("/api/admin/realtime/vehicles/refresh").with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
