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
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("FaresV2Controller Integration Tests")
class FaresV2ControllerIntegrationTest {

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
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/fares-v2"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("admin gets the eight Fares v2 sub-collections in one response, all empty by default")
    void adminGetsEmptyAggregate() throws Exception {
        mockMvc.perform(get("/api/admin/fares-v2").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.areas").isArray())
                .andExpect(jsonPath("$.timeframes").isArray())
                .andExpect(jsonPath("$.products").isArray())
                .andExpect(jsonPath("$.legRules").isArray())
                .andExpect(jsonPath("$.transferRules").isArray())
                .andExpect(jsonPath("$.networks").isArray())
                .andExpect(jsonPath("$.fareMedia").isArray())
                .andExpect(jsonPath("$.legJoinRules").isArray())
                .andExpect(jsonPath("$.areas", hasSize(0)))
                .andExpect(jsonPath("$.products", hasSize(0)));
    }
}
