package com.transit.hub.api.rest;

import com.transit.hub.domain.model.FeedInfo;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.FeedInfoRepository;
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
@DisplayName("FeedInfoController Integration Tests")
class FeedInfoControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private FeedInfoRepository feedInfoRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String adminToken;
    private String agentToken;

    @BeforeEach
    void setUp() {
        feedInfoRepository.deleteAll();
        userRepository.deleteAll();

        User admin = User.builder()
                .username("admin").password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN).enabled(true).build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);

        User agent = User.builder()
                .username("agent").password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT).enabled(true).build();
        userRepository.save(agent);
        agentToken = jwtService.generateToken(agent);
    }

    @Test
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/feed-info"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("agent gets 403 (admin-only)")
    void agentForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/feed-info").header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("admin gets 204 when no feed info row exists")
    void adminEmpty() throws Exception {
        mockMvc.perform(get("/api/admin/feed-info").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("admin gets the feed info when persisted")
    void adminReturnsFeedInfo() throws Exception {
        feedInfoRepository.save(FeedInfo.builder()
                .publisherName("M Réso").publisherUrl("https://www.mobilites-m.fr")
                .sourceUrl("https://data.mobilites-m.fr/api/gtfs/SEM")
                .sourceHash("abc123").build());

        mockMvc.perform(get("/api/admin/feed-info").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.publisherName", is("M Réso")))
                .andExpect(jsonPath("$.sourceUrl", is("https://data.mobilites-m.fr/api/gtfs/SEM")))
                .andExpect(jsonPath("$.sourceHash", is("abc123")));
    }
}
