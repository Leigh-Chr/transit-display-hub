package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse.AlertMessage;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Read-side service for the public alerts endpoint and the WebSocket alerts push.
 * Extracted from {@link NetworkMapService} (audit P2): the alerts pipeline only needs
 * the broadcast-message repository and a clock, while {@link NetworkMapService} carries
 * the heavier line/stop/transfer dependencies. Splitting it out drops one responsibility
 * from the network-map service and lets the two read paths cache and evolve independently.
 *
 * <p>Cache eviction for {@code networkAlerts} lives in
 * {@link NetworkMapPublisher#onMessageChanged} / {@link NetworkMapPublisher#onNetworkChanged};
 * keeping {@link Cacheable} on this side mirrors the previous placement on
 * {@link NetworkMapService#getAlerts} so the eviction wiring still hits the same cache.
 */
@Service
public class NetworkAlertsService {

    private final BroadcastMessageRepository broadcastMessageRepository;
    private final Clock clock;

    public NetworkAlertsService(BroadcastMessageRepository broadcastMessageRepository, Clock clock) {
        this.broadcastMessageRepository = broadcastMessageRepository;
        this.clock = clock;
    }

    @Cacheable("networkAlerts")
    @Transactional(readOnly = true)
    public AlertsResponse getAlerts() {
        List<BroadcastMessage> activeMessages = broadcastMessageRepository.findActiveMessages(Instant.now(clock));
        if (activeMessages.isEmpty()) {
            return new AlertsResponse(List.of(), Map.of(), Map.of());
        }

        List<AlertMessage> networkAlerts = new ArrayList<>();
        Map<UUID, List<AlertMessage>> lineAlerts = new HashMap<>();
        Map<UUID, List<AlertMessage>> stopAlerts = new HashMap<>();

        for (BroadcastMessage message : activeMessages) {
            var alertMsg = new AlertMessage(message.getTitle(), message.getContent(), message.getSeverity());

            switch (message.getScopeType()) {
                case NETWORK -> networkAlerts.add(alertMsg);
                case LINE -> lineAlerts.computeIfAbsent(message.getScopeId(), k -> new ArrayList<>()).add(alertMsg);
                case STOP -> stopAlerts.computeIfAbsent(message.getScopeId(), k -> new ArrayList<>()).add(alertMsg);
                default -> { /* no action for unknown scope types */ }
            }
        }

        return new AlertsResponse(networkAlerts, lineAlerts, stopAlerts);
    }
}
