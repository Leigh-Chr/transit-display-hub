package com.transit.hub.infrastructure.security;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.env.MockEnvironment;
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
        filter = new LoginRateLimitFilter(new MockEnvironment());
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
    void ignoresXForwardedForFromUntrustedRemote() throws Exception {
        // Default config: trustedProxies is empty. The TCP peer is the
        // source of truth, regardless of what XFF claims. So six
        // requests all share the 10.0.0.1 bucket and the sixth gets 429
        // — even though the attacker tried to vary the apparent IP.
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest r = loginRequest("10.0.0.1");
            r.addHeader("X-Forwarded-For", "203.0.113." + i);
            filter.doFilter(r, new MockHttpServletResponse(), chain);
        }
        MockHttpServletRequest sixth = loginRequest("10.0.0.1");
        sixth.addHeader("X-Forwarded-For", "203.0.113.99");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(sixth, res, chain);
        assertThat(res.getStatus()).isEqualTo(429);
    }

    @Test
    void honoursXForwardedForOnlyWhenRemoteIsATrustedProxy() throws Exception {
        ReflectionTestUtils.setField(filter, "trustedProxiesCsv", "10.0.0.1");
        filter.parseTrustedProxies();

        // Five requests from the trusted proxy carrying the same client
        // IP via XFF — they all count against the *client* bucket.
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

        // A different real client through the same proxy still has its
        // own quota — bucket is keyed on the XFF value, not the proxy.
        MockHttpServletRequest other = loginRequest("10.0.0.1");
        other.addHeader("X-Forwarded-For", "203.0.113.42");
        MockHttpServletResponse otherRes = new MockHttpServletResponse();
        filter.doFilter(other, otherRes, chain);
        assertThat(otherRes.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void honoursXForwardedForWhenRemoteMatchesACidrBlock() throws Exception {
        // The .env.example documents CSV entries of the shape
        // "10.0.0.0/8,192.168.0.0/16". The filter must parse the CIDR
        // block and treat any address inside it as a trusted proxy —
        // otherwise the rate-limit bucket is shared by every client
        // sitting behind the corporate NAT.
        ReflectionTestUtils.setField(filter, "trustedProxiesCsv", "10.0.0.0/8,192.168.0.0/16");
        filter.parseTrustedProxies();

        // Five attempts from one real client via a proxy at 10.4.5.6
        // — bucket is keyed on the XFF value, not the proxy.
        for (int i = 0; i < 5; i++) {
            MockHttpServletRequest r = loginRequest("10.4.5.6");
            r.addHeader("X-Forwarded-For", "203.0.113.30");
            filter.doFilter(r, new MockHttpServletResponse(), chain);
        }
        MockHttpServletRequest sixth = loginRequest("10.4.5.6");
        sixth.addHeader("X-Forwarded-For", "203.0.113.30");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(sixth, res, chain);
        assertThat(res.getStatus()).isEqualTo(429);

        // A different client behind a different proxy inside the same
        // /8 block still has its own quota.
        MockHttpServletRequest other = loginRequest("10.99.99.99");
        other.addHeader("X-Forwarded-For", "198.51.100.7");
        MockHttpServletResponse otherRes = new MockHttpServletResponse();
        filter.doFilter(other, otherRes, chain);
        assertThat(otherRes.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void ignoresInvalidTrustedProxyEntriesAndKeepsTheValidOnes() throws Exception {
        ReflectionTestUtils.setField(filter, "trustedProxiesCsv",
                "not-an-ip, 10.0.0.0/8 , bogus/99 ,192.168.1.1");
        filter.parseTrustedProxies();

        // The /8 entry must still match — invalid entries are skipped, not fatal.
        MockHttpServletRequest req = loginRequest("10.1.2.3");
        req.addHeader("X-Forwarded-For", "203.0.113.40");
        MockHttpServletResponse res = new MockHttpServletResponse();
        filter.doFilter(req, res, chain);
        assertThat(res.getStatus()).isEqualTo(HttpServletResponse.SC_OK);

        // Literal "192.168.1.1" entry still works post-CIDR refactor.
        MockHttpServletRequest req2 = loginRequest("192.168.1.1");
        req2.addHeader("X-Forwarded-For", "203.0.113.41");
        MockHttpServletResponse res2 = new MockHttpServletResponse();
        filter.doFilter(req2, res2, chain);
        assertThat(res2.getStatus()).isEqualTo(HttpServletResponse.SC_OK);
    }

    @Test
    void emitsWarningWhenDevProfileActiveAndLimitIsLoose() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");
        LoginRateLimitFilter looseDev = new LoginRateLimitFilter(env);
        ReflectionTestUtils.setField(looseDev, "maxAttempts", 100);
        ReflectionTestUtils.setField(looseDev, "windowMinutes", 5);

        ListAppender<ILoggingEvent> appender = attachAppender();

        looseDev.warnIfLooseLimitOnDevProfile();

        assertThat(appender.list)
                .anySatisfy(event -> {
                    assertThat(event.getLevel()).isEqualTo(Level.WARN);
                    assertThat(event.getFormattedMessage())
                            .contains("100", "dev")
                            .contains("public internet");
                });
    }

    @Test
    void doesNotWarnWhenDevProfileActiveButLimitMatchesProdDefault() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("dev");
        LoginRateLimitFilter tightDev = new LoginRateLimitFilter(env);
        ReflectionTestUtils.setField(tightDev, "maxAttempts", 5);
        ReflectionTestUtils.setField(tightDev, "windowMinutes", 5);

        ListAppender<ILoggingEvent> appender = attachAppender();

        tightDev.warnIfLooseLimitOnDevProfile();

        assertThat(appender.list).noneMatch(e -> e.getLevel() == Level.WARN);
    }

    @Test
    void doesNotWarnOnNonDevProfileEvenWithLooseLimit() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("prod");
        LoginRateLimitFilter looseProd = new LoginRateLimitFilter(env);
        ReflectionTestUtils.setField(looseProd, "maxAttempts", 100);
        ReflectionTestUtils.setField(looseProd, "windowMinutes", 5);

        ListAppender<ILoggingEvent> appender = attachAppender();

        looseProd.warnIfLooseLimitOnDevProfile();

        assertThat(appender.list).noneMatch(e -> e.getLevel() == Level.WARN);
    }

    private ListAppender<ILoggingEvent> attachAppender() {
        Logger logger = (Logger) LoggerFactory.getLogger(LoginRateLimitFilter.class);
        ListAppender<ILoggingEvent> appender = new ListAppender<>();
        appender.start();
        logger.addAppender(appender);
        return appender;
    }

    private MockHttpServletRequest loginRequest(String ip) {
        MockHttpServletRequest req = new MockHttpServletRequest("POST", "/api/auth/login");
        req.setRemoteAddr(ip);
        return req;
    }
}
