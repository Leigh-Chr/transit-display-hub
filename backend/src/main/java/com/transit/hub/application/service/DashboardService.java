package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DashboardResponse;
import com.transit.hub.application.dto.response.DeviceResponse;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.application.support.Pages;
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

import java.time.Clock;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
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
    private final MessageScopeResolver scopeResolver;
    private final Clock clock;

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
        List<LineResponse> topLines = Pages.hydrate(topIdsPage, topLineEntities, Line::getId)
                .getContent()
                .stream()
                .map(LineResponse::from)
                .toList();

        Instant now = Instant.now(clock);
        List<BroadcastMessage> activeRaw = messageRepository.findActiveMessages(now);
        Map<UUID, String> lineNames = scopeResolver.bulkLineNames(activeRaw);
        Map<UUID, String> stopNames = scopeResolver.bulkStopNames(activeRaw);
        List<MessageResponse> activeMessages = activeRaw.stream()
                .map(m -> scopeResolver.toResponse(m, lineNames, stopNames))
                .toList();

        var recentPage = messageRepository.findAll(
                PageRequest.of(0, RECENT_MESSAGES, Sort.by(Sort.Direction.DESC, "startTime")));
        Map<UUID, String> recentLineNames = scopeResolver.bulkLineNames(recentPage.getContent());
        Map<UUID, String> recentStopNames = scopeResolver.bulkStopNames(recentPage.getContent());
        List<MessageResponse> recentMessages = recentPage.getContent().stream()
                .map(m -> scopeResolver.toResponse(m, recentLineNames, recentStopNames))
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

}
