package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Translation;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
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
@DisplayName("TranslationController Integration Tests")
class TranslationControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private TranslationRepository translationRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;

    @BeforeEach
    void setUp() {
        translationRepository.deleteAll();
        userRepository.deleteAll();
        adminToken = authHelper.createAdminToken();
    }

    @Test
    @DisplayName("anonymous gets 401 (no lang param even bypasses auth)")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/translations?lang=fr"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("missing required `lang` query param returns 400")
    void missingLangReturns400() throws Exception {
        mockMvc.perform(get("/api/admin/translations").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("admin gets the empty list when no translation matches the language")
    void adminEmpty() throws Exception {
        mockMvc.perform(get("/api/admin/translations?lang=fr").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("admin gets the persisted translations filtered by language")
    void adminGetsTranslations() throws Exception {
        translationRepository.save(Translation.builder()
                .tableName("stops").recordId("STOP_1").fieldName("stop_name")
                .language("fr").translation("Verdun — Préfecture").build());
        translationRepository.save(Translation.builder()
                .tableName("stops").recordId("STOP_1").fieldName("stop_name")
                .language("en").translation("Verdun — Prefecture").build());

        mockMvc.perform(get("/api/admin/translations?lang=fr")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].language", is("fr")))
                .andExpect(jsonPath("$[0].tableName", is("stops")))
                .andExpect(jsonPath("$[0].translation", is("Verdun — Préfecture")));
    }

    @Test
    @DisplayName("table query param scopes to the matching GTFS table")
    void filtersByTable() throws Exception {
        translationRepository.save(Translation.builder()
                .tableName("stops").recordId("S1").fieldName("stop_name")
                .language("fr").translation("Place").build());
        translationRepository.save(Translation.builder()
                .tableName("routes").recordId("R1").fieldName("route_long_name")
                .language("fr").translation("Ligne A").build());

        mockMvc.perform(get("/api/admin/translations?lang=fr&table=routes")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].tableName", is("routes")));
    }
}
