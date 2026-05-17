package com.transit.hub.infrastructure.observability;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("RequestIdFilter — MDC + X-Request-Id propagation")
class RequestIdFilterTest {

    private final RequestIdFilter filter = new RequestIdFilter();

    @AfterEach
    void cleanMdc() {
        MDC.clear();
    }

    @Test
    void mintsAUuidWhenNoIncomingHeader() throws Exception {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/x");
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicReference<String> inMdc = new AtomicReference<>();
        FilterChain chain = (_req, _res) -> inMdc.set(MDC.get(RequestIdFilter.MDC_KEY));

        filter.doFilter(req, res, chain);

        assertThat(inMdc.get()).isNotNull();
        // RFC-4122 UUID string format check — eight-four-four-four-twelve hex.
        UUID.fromString(inMdc.get());
        assertThat(res.getHeader(RequestIdFilter.HEADER)).isEqualTo(inMdc.get());
    }

    @Test
    void honoursAnIncomingHeader() throws Exception {
        String supplied = "trace-abcd-1234";
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/x");
        req.addHeader(RequestIdFilter.HEADER, supplied);
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicReference<String> inMdc = new AtomicReference<>();
        FilterChain chain = (_req, _res) -> inMdc.set(MDC.get(RequestIdFilter.MDC_KEY));

        filter.doFilter(req, res, chain);

        assertThat(inMdc.get()).isEqualTo(supplied);
        assertThat(res.getHeader(RequestIdFilter.HEADER)).isEqualTo(supplied);
    }

    @Test
    void mintsAUuidWhenIncomingHeaderIsOversized() throws Exception {
        // Caller-supplied ids longer than 64 chars are treated as
        // hostile (or simply broken) — the filter falls back to a
        // freshly minted UUID rather than letting an opaque blob
        // bleed into every log line.
        String oversized = "x".repeat(65);
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/x");
        req.addHeader(RequestIdFilter.HEADER, oversized);
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicReference<String> inMdc = new AtomicReference<>();
        FilterChain chain = (_req, _res) -> inMdc.set(MDC.get(RequestIdFilter.MDC_KEY));

        filter.doFilter(req, res, chain);

        assertThat(inMdc.get()).isNotEqualTo(oversized);
        UUID.fromString(inMdc.get());
    }

    @Test
    void mintsAUuidWhenIncomingHeaderContainsControlChars() throws Exception {
        // Caller-supplied ids with CR/LF or other control characters
        // are treated as hostile (HTTP response splitting attempts) —
        // the filter mints a fresh UUID rather than echoing them back
        // on the response header.
        String malicious = "abc\r\nSet-Cookie: evil=1";
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/x");
        req.addHeader(RequestIdFilter.HEADER, malicious);
        MockHttpServletResponse res = new MockHttpServletResponse();
        AtomicReference<String> inMdc = new AtomicReference<>();
        FilterChain chain = (_req, _res) -> inMdc.set(MDC.get(RequestIdFilter.MDC_KEY));

        filter.doFilter(req, res, chain);

        assertThat(inMdc.get()).isNotEqualTo(malicious);
        UUID.fromString(inMdc.get());
        assertThat(res.getHeader(RequestIdFilter.HEADER)).doesNotContain("\r", "\n");
    }

    @Test
    void clearsMdcEvenWhenTheDownstreamChainThrows() {
        MockHttpServletRequest req = new MockHttpServletRequest("GET", "/x");
        MockHttpServletResponse res = new MockHttpServletResponse();
        FilterChain throwing = (_req, _res) -> { throw new RuntimeException("boom"); };

        try {
            filter.doFilter(req, res, throwing);
        } catch (Exception ignored) {
            // expected — the filter doesn't swallow it.
        }
        assertThat(MDC.get(RequestIdFilter.MDC_KEY)).isNull();
    }
}
