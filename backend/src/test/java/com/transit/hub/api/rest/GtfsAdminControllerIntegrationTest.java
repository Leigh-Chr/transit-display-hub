package com.transit.hub.api.rest;

import com.transit.hub.application.service.GtfsImportOrchestrator;
import com.transit.hub.infrastructure.seed.gtfs.GtfsImportService;
import com.transit.hub.domain.model.enums.ImportStatus;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import static org.hamcrest.Matchers.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * The reimport endpoint is the only state-mutating admin surface that
 * isn't already covered by a happy-path test elsewhere. The two paths
 * worth pinning are: (a) auth + role gating, (b) the "no feed URL
 * configured" early return, (c) the success / failure branches when
 * the upstream orchestrator is mocked.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("GtfsAdminController Integration Tests")
@TestPropertySource(properties = "app.data-loader.gtfs.url=https://example/feed.zip")
class GtfsAdminControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    @MockitoBean private GtfsImportOrchestrator orchestrator;

    private String adminToken;
    private String agentToken;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();

        adminToken = authHelper.createAdminToken();

        agentToken = authHelper.createAgentToken();
    }

    @Test
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(post("/api/admin/gtfs/reimport").with(csrf()))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("agent gets 403 (admin-only)")
    void agentForbidden() throws Exception {
        mockMvc.perform(post("/api/admin/gtfs/reimport").header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("admin triggers a successful re-import — orchestrator returns SUCCESS")
    void adminTriggersSuccess() throws Exception {
        when(orchestrator.runImport(anyString(), anyString()))
                .thenReturn(new GtfsImportOrchestrator.ImportOutcome(
                        ImportStatus.SUCCESS,
                        new GtfsImportService.ImportResult(55, 2501, 109, 2336, 434144),
                        null));

        mockMvc.perform(post("/api/admin/gtfs/reimport").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SUCCESS")))
                .andExpect(jsonPath("$.schedulesCount", is(434144)))
                .andExpect(jsonPath("$.message", nullValue()));
    }

    @Test
    @DisplayName("admin sees the FAILED outcome surfaced with its message")
    void adminSeesFailedOutcome() throws Exception {
        when(orchestrator.runImport(anyString(), anyString()))
                .thenReturn(new GtfsImportOrchestrator.ImportOutcome(
                        ImportStatus.FAILED, null, "feed unreachable"));

        mockMvc.perform(post("/api/admin/gtfs/reimport").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("FAILED")))
                .andExpect(jsonPath("$.schedulesCount", nullValue()))
                .andExpect(jsonPath("$.message", is("feed unreachable")));
    }

    @Test
    @DisplayName("admin sees SKIPPED_UNCHANGED when the feed hash matches the last import")
    void skippedUnchangedSurfaces() throws Exception {
        when(orchestrator.runImport(anyString(), anyString()))
                .thenReturn(new GtfsImportOrchestrator.ImportOutcome(
                        ImportStatus.SKIPPED_UNCHANGED, null, "feed hash unchanged"));

        mockMvc.perform(post("/api/admin/gtfs/reimport").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status", is("SKIPPED_UNCHANGED")));
    }
}
