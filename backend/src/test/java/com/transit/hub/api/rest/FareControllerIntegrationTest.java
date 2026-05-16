package com.transit.hub.api.rest;

import com.transit.hub.domain.model.FareAttribute;
import com.transit.hub.domain.model.enums.FarePaymentMethod;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
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

import java.math.BigDecimal;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Transactional
@DisplayName("FareController Integration Tests")
class FareControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private FareAttributeRepository fareAttributeRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;

    @BeforeEach
    void setUp() {
        fareAttributeRepository.deleteAll();
        userRepository.deleteAll();
        adminToken = authHelper.createAdminToken();
    }

    @Test
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/fares"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("admin gets the empty list with no fares persisted")
    void adminEmpty() throws Exception {
        mockMvc.perform(get("/api/admin/fares").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("admin gets each persisted fare with its v1 metadata + empty rules")
    void adminGetsFares() throws Exception {
        fareAttributeRepository.save(FareAttribute.builder()
                .externalId("FARE-1").price(new BigDecimal("1.80")).currency("EUR")
                .paymentMethod(FarePaymentMethod.PREPAID).transfers(1)
                .build());

        mockMvc.perform(get("/api/admin/fares").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("FARE-1")))
                .andExpect(jsonPath("$[0].price", is(1.80)))
                .andExpect(jsonPath("$[0].currency", is("EUR")))
                .andExpect(jsonPath("$[0].paymentMethod", is("PREPAID")))
                .andExpect(jsonPath("$[0].rules").isArray())
                .andExpect(jsonPath("$[0].rules", hasSize(0)));
    }
}
