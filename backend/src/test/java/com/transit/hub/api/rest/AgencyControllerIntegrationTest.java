package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.AgencyRepository;
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
@DisplayName("AgencyController Integration Tests")
class AgencyControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private AgencyRepository agencyRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String agentToken;

    @BeforeEach
    void setUp() {
        agencyRepository.deleteAll();
        userRepository.deleteAll();

        User agent = User.builder()
                .username("agent").password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT).enabled(true).build();
        userRepository.save(agent);
        agentToken = jwtService.generateToken(agent);
    }

    @Test
    @DisplayName("requires authentication (any role) — anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/agencies"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("authenticated agent gets the empty list when no agencies are persisted")
    void authenticatedEmpty() throws Exception {
        mockMvc.perform(get("/api/agencies").header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("returns each persisted agency with its GTFS metadata")
    void returnsPersistedAgencies() throws Exception {
        agencyRepository.save(Agency.builder()
                .externalId("SMMAG").name("M Réso").url("https://www.mobilites-m.fr")
                .timezone("Europe/Paris").lang("fr").phone("+33476205555")
                .build());

        mockMvc.perform(get("/api/agencies").header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("SMMAG")))
                .andExpect(jsonPath("$[0].name", is("M Réso")))
                .andExpect(jsonPath("$[0].timezone", is("Europe/Paris")))
                .andExpect(jsonPath("$[0].lang", is("fr")));
    }
}
