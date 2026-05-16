package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.PathwayMode;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("PathwayController Integration Tests")
class PathwayControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private StopRepository stopRepository;
    @Autowired private PathwayRepository pathwayRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String agentToken;
    private UUID centralStopId;

    @BeforeEach
    void setUp() {
        pathwayRepository.deleteAll();
        stopRepository.deleteAll();
        userRepository.deleteAll();

        agentToken = authHelper.createAgentToken();

        Stop platformA = stopRepository.save(Stop.builder()
                .name("Quai A").lines(new HashSet<>()).build());
        Stop platformB = stopRepository.save(Stop.builder()
                .name("Quai B").lines(new HashSet<>()).build());
        centralStopId = platformA.getId();

        pathwayRepository.save(Pathway.builder()
                .externalId("PW-1").fromStop(platformA).toStop(platformB)
                .pathwayMode(PathwayMode.STAIRS).bidirectional(true)
                .traversalTimeSeconds(45)
                .build());
    }

    @Test
    @DisplayName("requires authentication — anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/stops/{id}/pathways", centralStopId))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("returns the pathways touching the given stop, sorted by direction then mode")
    void returnsPathwaysSorted() throws Exception {
        mockMvc.perform(get("/api/stops/{id}/pathways", centralStopId)
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("PW-1")))
                .andExpect(jsonPath("$[0].pathwayMode", is("STAIRS")))
                .andExpect(jsonPath("$[0].bidirectional", is(true)))
                .andExpect(jsonPath("$[0].traversalTimeSeconds", is(45)));
    }

    @Test
    @DisplayName("returns empty array when the stop has no pathways")
    void emptyForUnknownStop() throws Exception {
        mockMvc.perform(get("/api/stops/{id}/pathways", UUID.randomUUID())
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }
}
