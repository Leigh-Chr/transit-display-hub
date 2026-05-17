package com.transit.hub.api.actuator;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.UserRepository;
import com.transit.hub.infrastructure.security.JwtService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end smoke test for the Prometheus scrape endpoint.
 *
 * <p>Three contracts:
 * <ol>
 *   <li>/actuator/prometheus is fenced behind ADMIN — anonymous scrapers
 *       used to enumerate the entire HTTP endpoint catalogue (audit
 *       2026-05-12, P1 #1). Local Prometheus must scrape with a JWT or
 *       the route must be gated at the reverse-proxy layer.</li>
 *   <li>The Micrometer registry is populated with the expected
 *       out-of-the-box metrics families (JVM + HTTP server) — proves
 *       the micrometer-registry-prometheus dependency is wired.</li>
 *   <li>The custom GTFS import metrics names appear, even before any
 *       import has run (the meters are registered at construction
 *       time).</li>
 * </ol>
 *
 * <p><b>Note on runtime:</b> this class often appears at the top of the
 * "slowest tests" list (~20 s wall-clock) because Gradle picks it first
 * — its {@code com.transit.hub.api.actuator} package sorts before
 * {@code com.transit.hub.api.rest}. The four assertions themselves run
 * in ~1 s; the rest is the one-time Spring application-context boot
 * that every other {@code @SpringBootTest} reuses from cache afterward.
 * Switching the package or annotation wouldn't reduce the total wall
 * time — it would just shift the cold-start cost to whichever IT lands
 * first.</p>
 */
@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("Prometheus actuator — scrape format")
class PrometheusEndpointIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String adminToken;

    @BeforeEach
    void setUp() {
        User admin = User.builder()
                .username("prom-admin")
                .password(passwordEncoder.encode("dummy"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);
    }

    @Test
    @DisplayName("rejects anonymous scrapes — endpoint is admin-gated")
    void anonymousScrape_Returns401() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("returns 200 to an admin JWT and exposes JVM + HTTP server metrics")
    void prometheusEndpointAdminGated() throws Exception {
        mockMvc.perform(get("/actuator/prometheus")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/plain"))
                .andExpect(content().string(containsString("jvm_memory_used_bytes")))
                .andExpect(content().string(containsString("http_server_requests")));
    }

    @Test
    @DisplayName("includes the GTFS import meters and the application=transit-display-hub tag")
    void customMetersExposed() throws Exception {
        mockMvc.perform(get("/actuator/prometheus")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(content().string(containsString("gtfs_import_completed_total")))
                .andExpect(content().string(containsString("gtfs_import_duration_seconds")))
                .andExpect(content().string(matchesPattern("(?s).*application=\"transit-display-hub\".*")));
    }

    @Test
    @DisplayName("/actuator/health stays open for compatibility with existing probes")
    void healthEndpointStillOpen() throws Exception {
        mockMvc.perform(get("/actuator/health"))
                .andExpect(status().isOk());
    }
}
