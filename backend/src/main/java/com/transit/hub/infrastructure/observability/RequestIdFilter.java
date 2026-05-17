package com.transit.hub.infrastructure.observability;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.MDC;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * Attaches a correlation id to every incoming HTTP request and
 * publishes it on the MDC so the logback pattern can include it on
 * every log line emitted within the request's thread.
 *
 * <p>The id is read from the {@code X-Request-Id} header when the
 * caller (an upstream reverse proxy, a load balancer) already provides
 * one — otherwise a fresh UUID is minted. It is echoed back on the
 * response so a downstream client can correlate its own logs without
 * negotiating the value with the server.
 *
 * <p>Runs at the very top of the filter chain so the id is set before
 * any other filter (auth, CORS, CSRF, rate-limit) logs anything.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestIdFilter extends OncePerRequestFilter {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "requestId";

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain chain) throws ServletException, IOException {
        String id = sanitize(request.getHeader(HEADER));
        if (id == null) {
            id = UUID.randomUUID().toString();
        }
        MDC.put(MDC_KEY, id);
        response.setHeader(HEADER, id);
        try {
            chain.doFilter(request, response);
        } finally {
            MDC.remove(MDC_KEY);
        }
    }

    /**
     * Defensive guard against HTTP response splitting (CWE-113): only
     * accept printable ASCII without CR/LF before echoing the header
     * back. Tomcat normally rejects bad headers up the chain, but the
     * filter is the trust boundary so we re-validate here too.
     */
    private static String sanitize(String raw) {
        if (raw == null || raw.isBlank() || raw.length() > 64) {
            return null;
        }
        for (int i = 0; i < raw.length(); i++) {
            char c = raw.charAt(i);
            if (c < 0x20 || c > 0x7E) {
                return null;
            }
        }
        return raw;
    }
}
