package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.AttributionResponse;
import com.transit.hub.application.service.AttributionService;
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

import static org.hamcrest.Matchers.*;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(controllers = AttributionController.class)
@AutoConfigureMockMvc(addFilters = false)
@DisplayName("AttributionController — WebMvcTest slice")
class AttributionControllerIntegrationTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private AttributionService attributionService;

    // Infrastructure beans — not under test here; mocked to satisfy the
    // application context when addFilters = false.
    @MockitoBean private JwtService jwtService;
    @MockitoBean private JwtAuthenticationFilter jwtAuthenticationFilter;
    @MockitoBean private LoginRateLimitFilter loginRateLimitFilter;
    @MockitoBean private CacheManager cacheManager;

    @Test
    @DisplayName("returns 200 + empty list when service returns nothing")
    void emptyList() throws Exception {
        when(attributionService.getAllAttributions()).thenReturn(List.of());

        mockMvc.perform(get("/api/attributions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    @DisplayName("returns the producer / operator / authority block from the service")
    void returnsServiceResult() throws Exception {
        when(attributionService.getAllAttributions()).thenReturn(List.of(
                new AttributionResponse("SMMAG", true, false, true,
                        "https://www.smmag.fr", "contact@smmag.fr", "+33476205555")
        ));

        mockMvc.perform(get("/api/attributions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].organizationName", is("SMMAG")))
                .andExpect(jsonPath("$[0].producer", is(true)))
                .andExpect(jsonPath("$[0].operator", is(false)))
                .andExpect(jsonPath("$[0].authority", is(true)))
                .andExpect(jsonPath("$[0].url", is("https://www.smmag.fr")));
    }

    @Test
    @DisplayName("returns multiple entries in service order")
    void returnsMultipleEntries() throws Exception {
        when(attributionService.getAllAttributions()).thenReturn(List.of(
                new AttributionResponse("SMMAG", true, false, true, null, null, null),
                new AttributionResponse("TAG", false, true, false, null, null, null)
        ));

        mockMvc.perform(get("/api/attributions"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(2)))
                .andExpect(jsonPath("$[0].organizationName", is("SMMAG")))
                .andExpect(jsonPath("$[1].organizationName", is("TAG")));
    }
}
