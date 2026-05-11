package com.transit.hub.infrastructure.websocket;

import com.transit.hub.application.dto.response.DeviceAuthResponse;
import com.transit.hub.application.service.DeviceService;
import com.transit.hub.infrastructure.security.JwtService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Configuration;
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
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

import java.util.List;
import java.util.Map;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
@Slf4j
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final JwtService jwtService;
    private final DeviceService deviceService;

    static final String DEVICE_ID_SESSION_KEY = "deviceId";

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
                .setAllowedOrigins(origins);
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
     * If the CONNECT frame carries a Bearer JWT, validate it and bind the
     * matching user principal to the STOMP session. An invalid or absent
     * token leaves the connection anonymous — public topics (kiosk,
     * network-map) keep working, private ones stay gated.
     */
    private void bindUserPrincipal(StompHeaderAccessor accessor) {
        List<String> authHeaders = accessor.getNativeHeader("Authorization");
        if (authHeaders == null || authHeaders.isEmpty()) {
            return;
        }
        String header = authHeaders.getFirst();
        if (header == null || !header.startsWith("Bearer ")) {
            return;
        }
        String token = header.substring("Bearer ".length()).trim();
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
            attrs = new java.util.HashMap<>();
            accessor.setSessionAttributes(attrs);
        }
        attrs.put(DEVICE_ID_SESSION_KEY, result.deviceId());
    }
}
