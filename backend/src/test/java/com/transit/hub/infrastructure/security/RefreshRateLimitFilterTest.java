package com.transit.hub.infrastructure.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class RefreshRateLimitFilterTest {

    private RefreshRateLimitFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new RefreshRateLimitFilter();
        // Small bucket so we don't have to spam the filter to exhaust it.
        ReflectionTestUtils.setField(filter, "maxAttempts", 3);
        ReflectionTestUtils.setField(filter, "windowMinutes", 1);
        chain = mock(FilterChain.class);
    }

    @Test
    void allowsFirstThreeRefreshAttemptsFromOneIp() throws Exception {
        for (int i = 0; i < 3; i++) {
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(refreshRequest("203.0.113.50"), res, chain);
            assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
        }
        verify(chain, times(3)).doFilter(any(), any());
    }

    @Test
    void blocksFourthRefreshAttemptWithinWindow() throws Exception {
        String ip = "203.0.113.51";
        for (int i = 0; i < 3; i++) {
            filter.doFilter(refreshRequest(ip), new MockHttpServletResponse(), chain);
        }
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(refreshRequest(ip), res, chain);
        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getHeader("Retry-After")).isNotNull();
        verify(chain, times(3)).doFilter(any(), any());
    }

    @Test
    void doesNotApplyToLoginOrOtherAuthEndpoints() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
        req.setRemoteAddr("203.0.113.52");
        MockHttpServletResponse res = new MockHttpServletResponse();
        for (int i = 0; i < 10; i++) {
            filter.doFilter(req, res, chain);
        }
        verify(chain, times(10)).doFilter(any(), any());
    }

    private MockHttpServletRequest refreshRequest(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/refresh");
        req.setRemoteAddr(ip);
        return req;
    }
}
