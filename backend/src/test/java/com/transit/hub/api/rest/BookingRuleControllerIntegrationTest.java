package com.transit.hub.api.rest;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.enums.BookingType;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
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
@DisplayName("BookingRuleController Integration Tests")
class BookingRuleControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private BookingRuleRepository bookingRuleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private com.transit.hub.testutil.AuthTestHelper authHelper;

    private String adminToken;
    private String agentToken;

    @BeforeEach
    void setUp() {
        bookingRuleRepository.deleteAll();
        userRepository.deleteAll();

        adminToken = authHelper.createAdminToken();
        agentToken = authHelper.createAgentToken();
    }

    @Test
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/booking-rules"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("agent gets 403 (admin-only)")
    void agentForbidden() throws Exception {
        mockMvc.perform(get("/api/admin/booking-rules")
                        .header("Authorization", "Bearer " + agentToken))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("admin gets 200 with empty list when no booking rule exists")
    void emptyList() throws Exception {
        mockMvc.perform(get("/api/admin/booking-rules")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("admin gets each booking rule with its phone / notice metadata")
    void returnsRepositoryRow() throws Exception {
        bookingRuleRepository.save(BookingRule.builder()
                .externalId("BR-1")
                .bookingType(BookingType.PRIOR_DAYS)
                .priorNoticeDurationMin(30)
                .phone("+33476201234")
                .infoUrl("https://www.mobilites-m.fr/tad")
                .build());

        mockMvc.perform(get("/api/admin/booking-rules")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("BR-1")))
                .andExpect(jsonPath("$[0].bookingType", is("PRIOR_DAYS")))
                .andExpect(jsonPath("$[0].priorNoticeDurationMin", is(30)))
                .andExpect(jsonPath("$[0].phone", is("+33476201234")));
    }

    @Test
    @DisplayName("admin gets multiple rules ranked by booking type ordinal")
    void returnsMultipleRules() throws Exception {
        bookingRuleRepository.save(BookingRule.builder()
                .externalId("BR-1")
                .bookingType(BookingType.PRIOR_DAYS)
                .priorNoticeDurationMin(30)
                .phone("+33476201234")
                .build());
        bookingRuleRepository.save(BookingRule.builder()
                .externalId("BR-2")
                .bookingType(BookingType.REAL_TIME)
                .phone("+33476209999")
                .build());

        // Service sorts by booking type ordinal: REAL_TIME (0) before
        // PRIOR_DAYS (later).
        mockMvc.perform(get("/api/admin/booking-rules")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].externalId", is("BR-2")))
                .andExpect(jsonPath("$[1].externalId", is("BR-1")));
    }
}
