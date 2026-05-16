package com.transit.hub.api.rest;

import com.transit.hub.domain.model.ImportAudit;
import com.transit.hub.domain.model.enums.ImportStatus;
import com.transit.hub.infrastructure.persistence.ImportAuditRepository;
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

import java.time.Instant;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@Execution(ExecutionMode.SAME_THREAD)
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("ImportAuditController Integration Tests")
class ImportAuditControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ImportAuditRepository importAuditRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;

    @BeforeEach
    void setUp() {
        importAuditRepository.deleteAll();
        userRepository.deleteAll();
        adminToken = authHelper.createAdminToken();
    }

    @Test
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/import-audit"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("admin gets the most recent attempts ordered DESC by startedAt")
    void adminGetsAuditsOrdered() throws Exception {
        Instant t0 = Instant.parse("2026-05-01T10:00:00Z");
        importAuditRepository.save(ImportAudit.builder()
                .sourceUrl("https://feed.example/static.zip").sourceHash("aaa")
                .startedAt(t0).status(ImportStatus.SUCCESS)
                .triggeredBy("admin").linesCount(50).build());
        importAuditRepository.save(ImportAudit.builder()
                .sourceUrl("https://feed.example/static.zip").sourceHash("bbb")
                .startedAt(t0.plusSeconds(3600)).status(ImportStatus.SKIPPED_UNCHANGED)
                .triggeredBy("scheduler").build());

        mockMvc.perform(get("/api/admin/import-audit").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].status", is("SKIPPED_UNCHANGED")))
                .andExpect(jsonPath("$[0].triggeredBy", is("scheduler")))
                .andExpect(jsonPath("$[1].status", is("SUCCESS")))
                .andExpect(jsonPath("$[1].linesCount", is(50)));
    }

    @Test
    @DisplayName("limit query param caps the number of rows")
    void respectsLimit() throws Exception {
        Instant t0 = Instant.parse("2026-05-01T10:00:00Z");
        for (int i = 0; i < 5; i++) {
            importAuditRepository.save(ImportAudit.builder()
                    .sourceUrl("u").sourceHash("h" + i)
                    .startedAt(t0.plusSeconds(60L * i))
                    .status(ImportStatus.SUCCESS).triggeredBy("admin").build());
        }
        mockMvc.perform(get("/api/admin/import-audit?limit=2")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)));
    }
}
