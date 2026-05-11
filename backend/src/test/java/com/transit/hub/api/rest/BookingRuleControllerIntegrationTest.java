package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.BookingRuleResponse;
import com.transit.hub.application.service.BookingRuleService;
import com.transit.hub.domain.model.enums.BookingType;
import com.transit.hub.infrastructure.security.JwtAuthenticationFilter;
import com.transit.hub.infrastructure.security.JwtService;
import com.transit.hub.infrastructure.security.LoginRateLimitFilter;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.cache.CacheManager;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = BookingRuleController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("BookingRuleController — WebMvcTest slice")
class BookingRuleControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private BookingRuleService bookingRuleService;

    // Infrastructure beans — not under test here; mocked to satisfy the
    // application context when addFilters = false.
    @MockitoBean private JwtService jwtService;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean private LoginRateLimitFilter loginRateLimitFilter;
    @MockitoBean private CacheManager cacheManager;

    @Test
    @DisplayName("returns 200 with empty list when service returns nothing")
    void emptyList() throws Exception {
        when(bookingRuleService.browse()).thenReturn(List.of());

        mockMvc.perform(get("/api/admin/booking-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("returns each booking rule with its phone / notice metadata")
    void returnsServiceResult() throws Exception {
        when(bookingRuleService.browse()).thenReturn(List.of(
                new BookingRuleResponse(
                        UUID.randomUUID(), "BR-1", BookingType.PRIOR_DAYS,
                        30, null, null, null, null,
                        "+33476201234", null, "https://www.mobilites-m.fr/tad", null)
        ));

        mockMvc.perform(get("/api/admin/booking-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].externalId", is("BR-1")))
                .andExpect(jsonPath("$[0].bookingType", is("PRIOR_DAYS")))
                .andExpect(jsonPath("$[0].priorNoticeDurationMin", is(30)))
                .andExpect(jsonPath("$[0].phone", is("+33476201234")));
    }

    @Test
    @DisplayName("returns multiple rules in the order the service provides")
    void returnsMultipleRules() throws Exception {
        when(bookingRuleService.browse()).thenReturn(List.of(
                new BookingRuleResponse(UUID.randomUUID(), "BR-1", BookingType.PRIOR_DAYS,
                        30, null, null, null, null, "+33476201234", null, null, null),
                new BookingRuleResponse(UUID.randomUUID(), "BR-2", BookingType.REAL_TIME,
                        null, null, null, null, null, "+33476209999", null, null, null)
        ));

        mockMvc.perform(get("/api/admin/booking-rules"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].externalId", is("BR-1")))
                .andExpect(jsonPath("$[1].externalId", is("BR-2")));
    }
}
