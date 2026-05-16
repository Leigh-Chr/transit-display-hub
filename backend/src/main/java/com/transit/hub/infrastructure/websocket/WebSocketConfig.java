package com.transit.hub.infrastructure.websocket;

import com.transit.hub.application.dto.response.DeviceAuthResponse;
import com.transit.hub.application.service.DeviceService;
import com.transit.hub.infrastructure.config.AuthProperties;
import com.transit.hub.infrastructure.security.JwtService;
import jakarta.servlet.http.Cookie;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.config.ChannelRegistration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;
import org.springframework.web.socket.config.annotation.WebSocketTransportRegistration;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final DeviceService deviceService;
    private final AuthProperties authProperties;

    static final String DEVICE_ID_SESSION_KEY = "deviceId";
    static final String ACCESS_TOKEN_SESSION_KEY = "accessToken";

    @org.springframework.beans.factory.annotation.Value("${app.cors.allowed-origins:http://localhost:4200,http://localhost:3000}")
    private String allowedOriginsCsv;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        config.enableSimpleBroker("/topic");
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String[] origins = java.util.Arrays.stream(allowedOriginsCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toArray(String[]::new);
        registry.addEndpoint("/ws")
                .setAllowedOrigins(origins)
                .addInterceptors(new AccessCookieHandshakeInterceptor());
    }

    /**
     * Caps the inbound STOMP frame and the per-session outbound buffer so
     * a slow / malicious client cannot pin server memory by accumulating
     * undelivered messages. Spring's defaults (65 KiB / 512 KiB / no send
     * timeout) are too lenient for a kiosk-heavy deployment where dozens
     * of Raspberry Pi receivers may share flaky Wi-Fi. The send timeout
     * matches what Tomcat applies elsewhere for stalled writes.
     */
    @Override
    public void configureWebSocketTransport(WebSocketTransportRegistration registration) {
        registration
                .setMessageSizeLimit(64 * 1024)
                .setSendBufferSizeLimit(512 * 1024)
                .setSendTimeLimit(20_000);
    }

    /**
     * Lifts the access JWT out of the cookie jar during the HTTP-to-WS
     * upgrade and stashes it in the STOMP session attributes. Anything
     * we put in {@code attributes} here ends up as the session attribute
     * map that the channel interceptor reads on CONNECT.
     *
     * <p>Reading the cookie at handshake time (instead of relying on the
     * client to mirror the JWT into a CONNECT header) means the access
     * token never has to be readable from JavaScript — an XSS payload
     * that lifts a cookie via {@code document.cookie} hits an httpOnly
     * cookie wall on every modern browser, so the WebSocket session
     * inherits the same protection as the rest of the API.
     */
    private class AccessCookieHandshakeInterceptor implements HandshakeInterceptor {
        @Override
        public boolean beforeHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                       WebSocketHandler wsHandler, Map<String, Object> attributes) {
            if (!(request instanceof ServletServerHttpRequest servlet)) {
                return true;
            }
            Cookie[] cookies = servlet.getServletRequest().getCookies();
            if (cookies == null) {
                return true;
            }
            for (Cookie cookie : cookies) {
                if (authProperties.accessCookieName().equals(cookie.getName())) {
                    String value = cookie.getValue();
                    if (value != null && !value.isBlank()) {
                        attributes.put(ACCESS_TOKEN_SESSION_KEY, value);
                    }
                    return true;
                }
            }
            return true;
        }

        @Override
        public void afterHandshake(ServerHttpRequest request, ServerHttpResponse response,
                                   WebSocketHandler wsHandler, Exception exception) {
            // nothing to clean up — sessions are tracked by Spring
        }
    }

    @Override
    public void configureClientInboundChannel(ChannelRegistration registration) {
        // Authenticate STOMP CONNECT frames using the same JWT the front-end sends
        // for HTTP requests. Anonymous connections are still allowed (kiosks and the
        // network map are public), but if a Bearer token is present we bind the
        // authenticated principal to the session so future authorization checks see it.
        registration.interceptors(new ChannelInterceptor() {
            @Override
            public Message<?> preSend(Message<?> message, MessageChannel channel) {
                StompHeaderAccessor accessor =
                        MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);
                if (accessor == null || !StompCommand.CONNECT.equals(accessor.getCommand())) {
                    return message;
                }
                bindUserPrincipal(accessor);
                bindDeviceIdIfPresent(accessor);
                return message;
            }
        });
    }

    /**
     * Resolves the access JWT for this CONNECT — preferring the value
     * the {@link AccessCookieHandshakeInterceptor} lifted out of the
     * {@code ACCESS_TOKEN} cookie, falling back to the {@code Authorization:
     * Bearer …} native header for legacy clients that still push the
     * token in-band. An invalid or absent token leaves the connection
     * anonymous — public topics (kiosk, network-map) keep working,
     * private ones stay gated.
     */
    private void bindUserPrincipal(StompHeaderAccessor accessor) {
        String token = resolveAccessToken(accessor);
        if (token == null) {
            return;
        }
        if (!jwtService.isValidToken(token)) {
            log.debug("STOMP CONNECT carries an expired/invalid token; "
                    + "falling back to anonymous (kiosk topics are public)");
            return;
        }
        String username = jwtService.extractUsername(token);
        String role = jwtService.extractRole(token).name();
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken(
                username,
                null,
                List.of(new SimpleGrantedAuthority("ROLE_" + role)));
        accessor.setUser(auth);
    }

    static String resolveAccessToken(StompHeaderAccessor accessor) {
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs != null) {
            Object cookieToken = attrs.get(ACCESS_TOKEN_SESSION_KEY);
            if (cookieToken instanceof String s && !s.isBlank()) {
                return s;
            }
        }
        List<String> authHeaders = accessor.getNativeHeader("Authorization");
        if (authHeaders == null || authHeaders.isEmpty()) {
            return null;
        }
        String header = authHeaders.getFirst();
        if (header == null || !header.startsWith("Bearer ")) {
            return null;
        }
        return header.substring("Bearer ".length()).trim();
    }

    /**
     * Kiosk clients may send a {@code device-token} native header alongside
     * (or instead of) the Bearer JWT. When present and valid, we bind the
     * resolved deviceId to the STOMP session attributes so that downstream
     * controllers ({@code DeviceHeartbeatController}) can match incoming
     * payload device-ids against the connected device and reject mismatches.
     *
     * <p>Anonymous CONNECTs (no device-token) keep working as before; the
     * heartbeat controller falls back to the legacy any-device behaviour
     * when no deviceId is bound.
     */
    private void bindDeviceIdIfPresent(StompHeaderAccessor accessor) {
        List<String> tokenHeaders = accessor.getNativeHeader("device-token");
        if (tokenHeaders == null || tokenHeaders.isEmpty()) {
            return;
        }
        String token = tokenHeaders.getFirst();
        if (token == null || token.isBlank()) {
            return;
        }
        DeviceAuthResponse result = deviceService.authenticateDevice(token.trim());
        if (!result.valid() || result.deviceId() == null) {
            log.debug("STOMP CONNECT carries an unknown device-token; staying unbound");
            return;
        }
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) {
            attrs = new HashMap<>();
            accessor.setSessionAttributes(attrs);
        }
        attrs.put(DEVICE_ID_SESSION_KEY, result.deviceId());
    }
}
