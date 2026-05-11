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

class LoginRateLimitFilterTest {

    private LoginRateLimitFilter filter;
    private FilterChain chain;

    @BeforeEach
    void setUp() {
        filter = new LoginRateLimitFilter();
        // The properties are normally bound from app.security.login-rate-limit.*
        // via @Value at Spring boot; in a pure-unit test we wire the defaults
        // ourselves so the bucket builds.
        ReflectionTestUtils.setField(filter, "maxAttempts", 5);
        ReflectionTestUtils.setField(filter, "windowMinutes", 5);
        chain = mock(FilterChain.class);
    }

    @Test
    void allowsFirstFiveLoginAttemptsFromOneIp() throws Exception {
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest req = loginRequest("203.0.113.10");
            MockHttpServletResponse res = new MockHttpServletResponse();
            filter.doFilter(req, res, chain);
            assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
        }
        verify(chain, times(5)).doFilter(any(), any());
    }

    @Test
    void blocksSixthLoginAttemptWithinWindow() throws Exception {
        String ip = "203.0.113.11";
        for (int i = 0; i < 5; i++) {
            filter.doFilter(loginRequest(ip), new MockHttpServletResponse(), chain);
        }
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(loginRequest(ip), res, chain);
        assertThat(res.getStatus()).isEqualTo(429);
        assertThat(res.getHeader("Retry-After")).isNotNull();
        verify(chain, times(5)).doFilter(any(), any());
    }

    @Test
    void doesNotApplyToOtherEndpoints() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/api/lines");
        req.setRemoteAddr("203.0.113.12");
        MockHttpServletResponse res = new MockHttpServletResponse();
        for (int i = 0; i < 10; i++) {
            filter.doFilter(req, res, chain);
        }
        verify(chain, times(10)).doFilter(any(), any());
    }

    @Test
    void honoursXForwardedForHeader() throws Exception {
        MockHttpServletRequest req = loginRequest("10.0.0.1");
        req.addHeader("X-Forwarded-For", "203.0.113.20, 10.0.0.99");
        // Send 5 from the X-Forwarded-For IP via 5 separate requests
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest r = loginRequest("10.0.0.1");
            r.addHeader("X-Forwarded-For", "203.0.113.20");
            filter.doFilter(r, new MockHttpServletResponse(), chain);
        }
        MockHttpServletRequest sixth = loginRequest("10.0.0.1");
        sixth.addHeader("X-Forwarded-For", "203.0.113.20");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(sixth, res, chain);
        assertThat(res.getStatus()).isEqualTo(429);
    }

    private MockHttpServletRequest loginRequest(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
        req.setRemoteAddr(ip);
        return req;
    }
}
