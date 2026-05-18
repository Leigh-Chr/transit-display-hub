package com.transit.hub.infrastructure.websocket;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.AbstractSubProtocolEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Component
@Slf4j
public class ActiveDisplayTracker {

    private static final Pattern DISPLAY_TOPIC_PATTERN = Pattern.compile("/topic/display/([a-f0-9-]+)");
    private static final String NETWORK_MAP_TOPIC = "/topic/network-map";

    // Map of stopId -> Set of sessionIds subscribed to that stop
    private final Map<UUID, Set<String>> activeSubscriptions = new ConcurrentHashMap<>();

    // Map of sessionId -> subscriptionId -> stopId (to handle unsubscribe)
    private final Map<String, Map<String, UUID>> sessionSubscriptions = new ConcurrentHashMap<>();

    // sessionId -> Set of subscriptionIds subscribed to /topic/network-map.
    // Tracked separately because the topic is global (no UUID parameter).
    private final Map<String, Set<String>> networkMapSubscriptions = new ConcurrentHashMap<>();

    @EventListener
    public void handleSubscribe(SessionSubscribeEvent event) {
        handleSafely(event, "subscribe", accessor -> {
            String destination = accessor.getDestination();
            String sessionId = accessor.getSessionId();
            String subscriptionId = accessor.getSubscriptionId();

            if (destination == null || sessionId == null) {
                return;
            }

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
            } else if (NETWORK_MAP_TOPIC.equals(destination)) {
                networkMapSubscriptions
                        .computeIfAbsent(sessionId, k -> ConcurrentHashMap.newKeySet())
                        .add(subscriptionId);
                log.debug("Client {} subscribed to network map", sessionId);
            }
        });
    }

    @EventListener
    public void handleUnsubscribe(SessionUnsubscribeEvent event) {
        handleSafely(event, "unsubscribe", accessor -> {
            String sessionId = accessor.getSessionId();
            String subscriptionId = accessor.getSubscriptionId();

            if (sessionId == null || subscriptionId == null) {
                return;
            }

            Map<String, UUID> subscriptions = sessionSubscriptions.get(sessionId);
            if (subscriptions != null) {
                UUID stopId = subscriptions.remove(subscriptionId);
                if (stopId != null) {
                    removeSubscription(stopId, sessionId);
                    log.debug("Client {} unsubscribed from stop {}", sessionId, stopId);
                }
            }

            Set<String> mapSubs = networkMapSubscriptions.get(sessionId);
            if (mapSubs != null && mapSubs.remove(subscriptionId) && mapSubs.isEmpty()) {
                networkMapSubscriptions.remove(sessionId);
            }
        });
    }

    @EventListener
    public void handleDisconnect(SessionDisconnectEvent event) {
        handleSafely(event, "disconnect", accessor -> {
            String sessionId = accessor.getSessionId();

            if (sessionId == null) {
                return;
            }

            Map<String, UUID> subscriptions = sessionSubscriptions.remove(sessionId);
            if (subscriptions != null) {
                for (UUID stopId : subscriptions.values()) {
                    removeSubscription(stopId, sessionId);
                }
                log.debug("Client {} disconnected, removed {} subscriptions", sessionId, subscriptions.size());
            }
            networkMapSubscriptions.remove(sessionId);
        });
    }

    /** Wraps the STOMP header parsing in a uniform try/catch so a malformed
     *  frame never escapes a listener and tears down the entire WS pipeline. */
    private void handleSafely(AbstractSubProtocolEvent event, String label, Consumer<StompHeaderAccessor> body) {
        try {
            body.accept(StompHeaderAccessor.wrap(event.getMessage()));
        } catch (Exception e) {
            log.warn("Error handling {} event: {}", label, e.getMessage());
        }
    }

    private void removeSubscription(UUID stopId, String sessionId) {
        // computeIfPresent is the atomic equivalent of "remove the session
        // and drop the stop entry if the set is now empty" — the previous
        // get/remove/isEmpty/remove sequence had a window where a second
        // subscribe between isEmpty() and remove(stopId) would lose its
        // session because the parent set had just been evicted.
        activeSubscriptions.computeIfPresent(stopId, (key, sessions) -> {
            sessions.remove(sessionId);
            return sessions.isEmpty() ? null : sessions;
        });
    }

    public Set<UUID> getActiveStopIds() {
        return Set.copyOf(activeSubscriptions.keySet());
    }

    public boolean hasActiveSubscriptions(UUID stopId) {
        Set<String> sessions = activeSubscriptions.get(stopId);
        return sessions != null && !sessions.isEmpty();
    }

    public boolean hasNetworkMapSubscribers() {
        return !networkMapSubscriptions.isEmpty();
    }
}
