package com.transit.hub.api.rest;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.BookingType;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
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
@DisplayName("BookingRuleController Integration Tests")
class BookingRuleControllerIntegrationTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private BookingRuleRepository bookingRuleRepository;
    @Autowired private UserRepository userRepository;
    @Autowired private PasswordEncoder passwordEncoder;
    @Autowired private JwtService jwtService;

    private String adminToken;

    @BeforeEach
    void setUp() {
        bookingRuleRepository.deleteAll();
        userRepository.deleteAll();
        User admin = User.builder()
                .username("admin").password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN).enabled(true).build();
        userRepository.save(admin);
        adminToken = jwtService.generateToken(admin);
    }

    @Test
    @DisplayName("anonymous gets 401")
    void requiresAuth() throws Exception {
        mockMvc.perform(get("/api/admin/booking-rules"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("admin gets the empty list when no rule is persisted")
    void adminEmpty() throws Exception {
        mockMvc.perform(get("/api/admin/booking-rules").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("admin gets each persisted booking rule with its phone / notice metadata")
    void adminGetsRules() throws Exception {
        bookingRuleRepository.save(BookingRule.builder()
                .externalId("BR-1").bookingType(BookingType.PRIOR_DAYS)
                .priorNoticeDurationMin(30).phone("+33476201234")
                .infoUrl("https://www.mobilites-m.fr/tad").build());

        mockMvc.perform(get("/api/admin/booking-rules").header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("BR-1")))
                .andExpect(jsonPath("$[0].bookingType", is("PRIOR_DAYS")))
                .andExpect(jsonPath("$[0].priorNoticeDurationMin", is(30)))
                .andExpect(jsonPath("$[0].phone", is("+33476201234")));
    }
}
