package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.infrastructure.websocket.ActiveDisplayTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Map;

/**
 * Pure write-side companion to {@link NetworkMapService}: listens for
 * domain events emitted after a transactional commit (a stop renamed,
 * a message published) and pushes a fresh snapshot over WebSocket to
 * the active network-map subscribers. Cache eviction happens here too
 * so the next consumer sees up-to-date data even when there is no
 * active subscriber to push to.
 *
 * <p>The split from {@link NetworkMapService} (audit P2) keeps the
 * read-side service free of broker dependencies and lets us mock the
 * push pipeline independently in tests. {@link NetworkMapService} no
 * longer reads from {@link SimpMessagingTemplate} or
 * {@link ActiveDisplayTracker}, just from the JPA repositories.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class NetworkMapPublisher {

    private final NetworkMapService networkMapService;
    private final NetworkAlertsService networkAlertsService;
    private final CacheManager cacheManager;
    private final SimpMessagingTemplate messagingTemplate;
    private final ActiveDisplayTracker activeDisplayTracker;

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onNetworkChanged(NetworkChangedEvent event) {
        try {
            evictCache("networkMap");
            evictCache("networkAlerts");
        } catch (Exception e) {
            log.warn("Failed to evict cache on network change: {}", e.getMessage());
        }
        pushNetworkMapUpdate();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageChanged(MessageChangedEvent event) {
        try {
            evictCache("networkAlerts");
        } catch (Exception e) {
            log.warn("Failed to evict cache on message change: {}", e.getMessage());
        }
        pushAlertsUpdate();
    }

    private void pushNetworkMapUpdate() {
        // Skip the recompute + serialize entirely when nobody is watching.
        // The cache invalidation already happened, so the next consumer will
        // get a fresh response on first GET anyway.
        if (!activeDisplayTracker.hasNetworkMapSubscribers()) {
            log.debug("Skipping network map push — no active subscribers");
            return;
        }
        try {
            NetworkMapResponse networkMap = networkMapService.getNetworkMap();
            AlertsResponse alerts = networkAlertsService.getAlerts();
            Object payload = Map.of("type", "FULL_UPDATE", "networkMap", networkMap, "alerts", alerts);
            messagingTemplate.convertAndSend("/topic/network-map", payload);
            log.debug("Pushed network map update via WebSocket");
        } catch (Exception e) {
            log.error("Failed to push network map update", e);
        }
    }

    private void pushAlertsUpdate() {
        if (!activeDisplayTracker.hasNetworkMapSubscribers()) {
            log.debug("Skipping alerts push — no active subscribers");
            return;
        }
        try {
            AlertsResponse alerts = networkAlertsService.getAlerts();
            Object payload = Map.of("type", "ALERTS_UPDATE", "alerts", alerts);
            messagingTemplate.convertAndSend("/topic/network-map", payload);
            log.debug("Pushed alerts update via WebSocket");
        } catch (Exception e) {
            log.error("Failed to push alerts update", e);
        }
    }

    private void evictCache(String cacheName) {
        var cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        }
    }
}
