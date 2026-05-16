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
@DisplayName("DataOverviewController Integration Tests")
class DataOverviewControllerIntegrationTest {

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
        mockMvc.perform(get("/api/admin/data-overview"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("admin gets the static-GTFS + realtime overview shape")
    void adminGetsShape() throws Exception {
        mockMvc.perform(get("/api/admin/data-overview").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.staticGtfs").isMap())
                .andExpect(jsonPath("$.staticGtfs.agencies", is(0)))
                .andExpect(jsonPath("$.staticGtfs.lines", is(0)))
                .andExpect(jsonPath("$.staticGtfs.stops", is(0)))
                .andExpect(jsonPath("$.staticGtfs.itineraries", is(0)))
                .andExpect(jsonPath("$.staticGtfs.schedules", is(0)))
                .andExpect(jsonPath("$.realtime").isMap())
                .andExpect(jsonPath("$.realtime.alerts", is(0)))
                .andExpect(jsonPath("$.realtime.tripUpdates", is(0)))
                .andExpect(jsonPath("$.realtime.vehiclePositions", is(0)))
                .andExpect(jsonPath("$.realtime.alertsEnabled", is(false)));
    }
}
