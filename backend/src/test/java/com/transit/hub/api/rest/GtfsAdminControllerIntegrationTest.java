package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.ImportAuditResponse;
import com.transit.hub.application.exception.ImportAlreadyRunningException;
import com.transit.hub.application.service.GtfsImportOrchestrator;
import com.transit.hub.application.service.ImportAuditService;
import com.transit.hub.infrastructure.persistence.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.hamcrest.Matchers.matchesPattern;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/**
 * The reimport endpoint is the only state-mutating admin surface that
 * isn't already covered by a happy-path test elsewhere. Async contract since
 * v1.21: 202 Accepted + Location pointing at the audit id, 409 Conflict
 * when another import already holds the lock.
 */
@Execution(ExecutionMode.SAME_THREAD)
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
    @MockitoBean private ImportAuditService importAuditService;

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
    @DisplayName("admin triggers an import — returns 202 Accepted and a Location header with the audit id")
    void adminTriggersReturns202WithLocation() throws Exception {
        UUID auditId = UUID.fromString("11111111-2222-3333-4444-555555555555");
        when(orchestrator.runImportAsync(anyString(), anyString())).thenReturn(auditId);

        mockMvc.perform(post("/api/admin/gtfs/reimport").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isAccepted())
                .andExpect(header().string("Location", "/api/admin/gtfs/imports/" + auditId));
    }

    @Test
    @DisplayName("admin Location header carries a UUID even when a fresh id is generated")
    void adminLocationHeaderHasUuidShape() throws Exception {
        when(orchestrator.runImportAsync(anyString(), anyString())).thenReturn(UUID.randomUUID());

        mockMvc.perform(post("/api/admin/gtfs/reimport").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isAccepted())
                .andExpect(header().string("Location",
                        matchesPattern("/api/admin/gtfs/imports/[0-9a-f-]{36}")));
    }

    @Test
    @DisplayName("returns 409 Conflict when another import is already running")
    void returns409WhenAlreadyRunning() throws Exception {
        when(orchestrator.runImportAsync(anyString(), anyString()))
                .thenThrow(new ImportAlreadyRunningException("error.gtfs.importAlreadyRunning"));

        mockMvc.perform(post("/api/admin/gtfs/reimport").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));
    }

    @Test
    @DisplayName("GET /imports/{id} — returns the audit when it exists")
    void getImportReturnsAudit() throws Exception {
        UUID auditId = UUID.fromString("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
        ImportAuditResponse response = new ImportAuditResponse(
                auditId, "https://example/feed.zip", "abc123",
                Instant.parse("2026-05-17T10:00:00Z"), Instant.parse("2026-05-17T10:00:30Z"),
                30_000L, 10, 50, 12, 200,
                com.transit.hub.domain.model.enums.ImportStatus.SUCCESS,
                null, "admin", "VALID", 0, 3);
        when(importAuditService.getById(eq(auditId))).thenReturn(Optional.of(response));

        mockMvc.perform(get("/api/admin/gtfs/imports/" + auditId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(auditId.toString()))
                .andExpect(jsonPath("$.status").value("SUCCESS"))
                .andExpect(jsonPath("$.triggeredBy").value("admin"));
    }

    @Test
    @DisplayName("GET /imports/{id} — returns 404 when the audit does not exist")
    void getImportReturns404WhenMissing() throws Exception {
        UUID unknownId = UUID.randomUUID();
        when(importAuditService.getById(eq(unknownId))).thenReturn(Optional.empty());

        mockMvc.perform(get("/api/admin/gtfs/imports/" + unknownId)
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("GET /imports/{id} — agent gets 403 (admin-only)")
    void getImportAgentForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/gtfs/imports/" + UUID.randomUUID())
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isForbidden());
    }
}
