package com.transit.hub.api.actuator;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * End-to-end smoke test for the Prometheus scrape endpoint.
 *
 * Verifies three contracts:
 *   1. /actuator/prometheus is reachable without authentication (the
 *      scrape side never carries JWT credentials).
 *   2. The Micrometer registry is populated with the expected
 *      out-of-the-box metrics families (JVM + HTTP server) — proves the
 *      micrometer-registry-prometheus dependency is wired.
 *   3. The custom GTFS import metrics names appear, even before any
 *      import has run (the meters are registered at construction time).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@DisplayName("Prometheus actuator — scrape format")
class PrometheusEndpointIntegrationTest {

    @Autowired private MockMvc mockMvc;

    @Test
    @DisplayName("returns 200 without auth and exposes JVM + HTTP server metrics")
    void prometheusEndpointPublicAndPopulated() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("text/plain"))
                .andExpect(content().string(containsString("jvm_memory_used_bytes")))
                .andExpect(content().string(containsString("http_server_requests")));
    }

    @Test
    @DisplayName("includes the GTFS import meters and the application=transit-display-hub tag")
    void customMetersExposed() throws Exception {
        mockMvc.perform(get("/actuator/prometheus"))
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
