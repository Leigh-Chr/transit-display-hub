package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DashboardResponse;
import com.transit.hub.application.dto.response.DeviceResponse;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Aggregates the data backing the admin dashboard in a single round-trip.
 * Replaces the legacy `forkJoin(getAll() x5)` that downloaded the entire
 * domain model on every dashboard open.
 */
@Service
@RequiredArgsConstructor
public class DashboardService {

    private static final int TOP_LINES = 6;
    private static final int RECENT_MESSAGES = 5;
    private static final int OFFLINE_PREVIEW = 6;

    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ItineraryRepository itineraryRepository;
    private final BroadcastMessageRepository messageRepository;
    private final DeviceRepository deviceRepository;

    @Transactional(readOnly = true)
    public DashboardResponse getSummary() {
        long lineCount = lineRepository.count();
        long stopCount = stopRepository.count();
        long itineraryCount = itineraryRepository.count();

        // Two-step: page over Line ids first (no JOIN FETCH so the
        // pagination stays in SQL), then hydrate the page with the
        // collections needed for the response.
        var topIdsPage = lineRepository.findAllIds(
                PageRequest.of(0, TOP_LINES, Sort.by("code")));
        List<Line> topLineEntities = topIdsPage.getContent().isEmpty()
                ? List.of()
                : lineRepository.findAllByIdInWithStopsAndRoutes(topIdsPage.getContent());
        Map<UUID, Line> topLineById = topLineEntities.stream()
                .collect(Collectors.toMap(Line::getId, l -> l));
        List<LineResponse> topLines = topIdsPage.getContent().stream()
                .map(topLineById::get)
                .filter(java.util.Objects::nonNull)
                .map(LineResponse::from)
                .toList();

        Instant now = Instant.now();
        List<BroadcastMessage> activeRaw = messageRepository.findActiveMessages(now);
        Map<UUID, String> lineNames = bulkLineNames(activeRaw);
        Map<UUID, String> stopNames = bulkStopNames(activeRaw);
        List<MessageResponse> activeMessages = activeRaw.stream()
                .map(m -> withScope(m, lineNames, stopNames))
                .toList();

        var recentPage = messageRepository.findAll(
                PageRequest.of(0, RECENT_MESSAGES, Sort.by(Sort.Direction.DESC, "startTime")));
        Map<UUID, String> recentLineNames = bulkLineNames(recentPage.getContent());
        Map<UUID, String> recentStopNames = bulkStopNames(recentPage.getContent());
        List<MessageResponse> recentMessages = recentPage.getContent().stream()
                .map(m -> withScope(m, recentLineNames, recentStopNames))
                .toList();

        long deviceTotal = deviceRepository.count();
        long deviceOnline = deviceRepository.countByStatus(DeviceStatus.ONLINE);
        long deviceOffline = deviceRepository.countByStatus(DeviceStatus.OFFLINE);
        List<DeviceResponse> offlinePreview = deviceRepository.findByStatus(DeviceStatus.OFFLINE).stream()
                .sorted(Comparator.comparing(d -> d.getStop() == null ? "" : d.getStop().getName()))
                .limit(OFFLINE_PREVIEW)
                .map(DeviceResponse::from)
                .toList();

        return new DashboardResponse(
                lineCount,
                stopCount,
                itineraryCount,
                topLines,
                activeMessages,
                recentMessages,
                new DashboardResponse.DeviceSummary(deviceTotal, deviceOnline, deviceOffline, offlinePreview)
        );
    }

    private MessageResponse withScope(
            BroadcastMessage message,
            Map<UUID, String> lineNames,
            Map<UUID, String> stopNames
    ) {
        MessageResponse.ScopeInfo scope = null;
        UUID id = message.getScopeId();
        if (id != null) {
            String name = switch (message.getScopeType()) {
                case LINE -> lineNames.get(id);
                case STOP -> stopNames.get(id);
                default -> null;
            };
            if (name != null) {
                scope = new MessageResponse.ScopeInfo(name);
            }
        }
        return MessageResponse.from(message, scope);
    }

    private Map<UUID, String> bulkLineNames(List<BroadcastMessage> messages) {
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

    private Map<UUID, String> bulkStopNames(List<BroadcastMessage> messages) {
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
}
