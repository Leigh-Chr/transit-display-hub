package com.transit.hub.infrastructure.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class ActiveDisplayTracker {

    private static final Pattern DISPLAY_TOPIC_PATTERN = Pattern.compile("/topic/display/([a-f0-9-]+)");

    // Map of stopId -> Set of sessionIds subscribed to that stop
    private final Map<UUID, Set<String>> activeSubscriptions = new ConcurrentHashMap<>();

    // Map of sessionId -> subscriptionId -> stopId (to handle unsubscribe)
    private final Map<String, Map<String, UUID>> sessionSubscriptions = new ConcurrentHashMap<>();

    @EventListener
    public void handleSubscribe(SessionSubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String destination = accessor.getDestination();
        String sessionId = accessor.getSessionId();
        String subscriptionId = accessor.getSubscriptionId();

        if (destination == null || sessionId == null) return;

        Matcher matcher = DISPLAY_TOPIC_PATTERN.matcher(destination);
        if (matcher.matches()) {
            UUID stopId = UUID.fromString(matcher.group(1));

            activeSubscriptions
                    .computeIfAbsent(stopId, k -> ConcurrentHashMap.newKeySet())
                    .add(sessionId);

            sessionSubscriptions
                    .computeIfAbsent(sessionId, k -> new ConcurrentHashMap<>())
                    .put(subscriptionId, stopId);

            log.debug("Client {} subscribed to stop {}", sessionId, stopId);
        }
    }

    @EventListener
    public void handleUnsubscribe(SessionUnsubscribeEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();
        String subscriptionId = accessor.getSubscriptionId();

        if (sessionId == null || subscriptionId == null) return;

        Map<String, UUID> subscriptions = sessionSubscriptions.get(sessionId);
        if (subscriptions != null) {
            UUID stopId = subscriptions.remove(subscriptionId);
            if (stopId != null) {
                removeSubscription(stopId, sessionId);
                log.debug("Client {} unsubscribed from stop {}", sessionId, stopId);
            }
        }
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        StompHeaderAccessor accessor = StompHeaderAccessor.wrap(event.getMessage());
        String sessionId = accessor.getSessionId();

        if (sessionId == null) return;

        Map<String, UUID> subscriptions = sessionSubscriptions.remove(sessionId);
        if (subscriptions != null) {
            for (UUID stopId : subscriptions.values()) {
                removeSubscription(stopId, sessionId);
            }
            log.debug("Client {} disconnected, removed {} subscriptions", sessionId, subscriptions.size());
        }
    }

    private void removeSubscription(UUID stopId, String sessionId) {
        Set<String> sessions = activeSubscriptions.get(stopId);
        if (sessions != null) {
            sessions.remove(sessionId);
            if (sessions.isEmpty()) {
                activeSubscriptions.remove(stopId);
            }
        }
    }

    public Set<UUID> getActiveStopIds() {
        return Set.copyOf(activeSubscriptions.keySet());
    }

    public boolean hasActiveSubscriptions(UUID stopId) {
        Set<String> sessions = activeSubscriptions.get(stopId);
        return sessions != null && !sessions.isEmpty();
    }
}
