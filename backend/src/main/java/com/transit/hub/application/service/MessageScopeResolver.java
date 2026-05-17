package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Shared helper for resolving the line/stop name that labels a
 * {@link BroadcastMessage}'s scope. Extracted from
 * {@link DashboardService} and {@link MessageService} to avoid
 * duplicating the two bulk-query methods and the per-message scope
 * switch across both services.
 */
@Service
@RequiredArgsConstructor
public class MessageScopeResolver {

    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final Clock clock;

    /**
     * Bulk-loads the line names referenced by any LINE-scoped message in
     * the list. Returns an empty map when none are present, avoiding a
     * wasted round-trip.
     */
    public Map<UUID, String> bulkLineNames(List<BroadcastMessage> messages) {
        Set<UUID> ids = messages.stream()
                .filter(m -> m.getScopeType() == MessageScope.LINE && m.getScopeId() != null)
                .map(BroadcastMessage::getScopeId)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> names = new HashMap<>();
        for (Line line : lineRepository.findAllById(ids)) {
            names.put(line.getId(), line.getName());
        }
        return names;
    }

    /**
     * Bulk-loads the stop names referenced by any STOP-scoped message in
     * the list. Returns an empty map when none are present.
     */
    public Map<UUID, String> bulkStopNames(List<BroadcastMessage> messages) {
        Set<UUID> ids = messages.stream()
                .filter(m -> m.getScopeType() == MessageScope.STOP && m.getScopeId() != null)
                .map(BroadcastMessage::getScopeId)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return Map.of();
        }
        Map<UUID, String> names = new HashMap<>();
        for (Stop stop : stopRepository.findAllById(ids)) {
            names.put(stop.getId(), stop.getName());
        }
        return names;
    }

    /**
     * Builds the {@link MessageResponse} for a single message using the
     * pre-loaded name maps. The maps are obtained from
     * {@link #bulkLineNames} and {@link #bulkStopNames} so the calling
     * service issues at most two queries per batch rather than one per
     * message.
     */
    public MessageResponse toResponse(
            BroadcastMessage message,
            Map<UUID, String> lineNames,
            Map<UUID, String> stopNames
    ) {
        MessageResponse.ScopeInfo scopeInfo = null;
        UUID scopeId = message.getScopeId();
        if (scopeId != null) {
            String name = switch (message.getScopeType()) {
                case LINE -> lineNames.get(scopeId);
                case STOP -> stopNames.get(scopeId);
                default -> null;
            };
            if (name != null) {
                scopeInfo = new MessageResponse.ScopeInfo(name);
            }
        }
        return MessageResponse.from(message, scopeInfo, Instant.now(clock));
    }
}
