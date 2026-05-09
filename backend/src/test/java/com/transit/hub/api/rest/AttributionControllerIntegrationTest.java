package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Attribution;
import com.transit.hub.infrastructure.persistence.AttributionRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
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
@DisplayName("AttributionController Integration Tests")
class AttributionControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private AttributionRepository attributionRepository;

    @BeforeEach
    void setUp() {
        attributionRepository.deleteAll();
    }

    @Test
    @DisplayName("returns 200 + empty list without authentication when no rows are persisted")
    void publicAccess_emptyByDefault() throws Exception {
        mockMvc.perform(get("/api/attributions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("returns the persisted producer / operator / authority block")
    void returnsPersistedRows() throws Exception {
        attributionRepository.save(Attribution.builder()
                .organizationName("SMMAG")
                .producer(true).operator(false).authority(true)
                .url("https://www.smmag.fr").email("contact@smmag.fr").phone("+33476205555")
                .build());

        mockMvc.perform(get("/api/attributions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].organizationName", is("SMMAG")))
                .andExpect(jsonPath("$[0].producer", is(true)))
                .andExpect(jsonPath("$[0].operator", is(false)))
                .andExpect(jsonPath("$[0].authority", is(true)))
                .andExpect(jsonPath("$[0].url", is("https://www.smmag.fr")));
    }
}
