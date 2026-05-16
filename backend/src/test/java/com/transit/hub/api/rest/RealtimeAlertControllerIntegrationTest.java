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

/**
 * Note: the realtime alerts feature is opt-in. With no
 * {@code app.gtfs-rt.alerts-url} configured (the test profile default),
 * the cache is disabled — the GET still works and returns an empty
 * snapshot, but POST /refresh returns 400 (the controller's explicit
 * "no upstream configured" guard).
 */
@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("RealtimeAlertController Integration Tests")
class RealtimeAlertControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;
    private String agentToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        adminToken = authHelper.createAdminToken();

        agentToken = authHelper.createAgentToken();
    }

    @Test
    @DisplayName("GET requires authentication")
    void getRequiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/realtime/alerts"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("GET is admin-only — agent gets 403")
    void agentForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/realtime/alerts").header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("admin GET returns the empty snapshot when the feed is disabled")
    void adminGetSnapshot() throws Exception {
        mockMvc.perform(get("/api/admin/realtime/alerts").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("POST /refresh returns 400 when no upstream URL is configured")
    void refreshDisabled() throws Exception {
        mockMvc.perform(post("/api/admin/realtime/alerts/refresh")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("POST /refresh requires authentication")
    void refreshRequiresAuth() throws Exception {
        mockMvc.perform(post("/api/admin/realtime/alerts/refresh").with(csrf()))
                .andExpect(status().isUnauthorized());
    }
}
