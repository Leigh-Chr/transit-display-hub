package com.transit.hub.domain.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Route;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.TimedEntry;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TimedEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.LocalTime;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class DisplayStateCalculator {

    private final StopRepository stopRepository;
    private final TimedEntryRepository timedEntryRepository;
    private final BroadcastMessageRepository messageRepository;

    private static final int MAX_MESSAGES = 3;
    private static final int WINDOW_MINUTES = 30;

    // Version tracking per stop
    private final Map<UUID, AtomicLong> versionMap = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public DisplayState calculateForStop(UUID stopId) {
        Stop stop = stopRepository.findByIdWithLines(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        // Get all lines info for this stop
        List<DisplayState.LineInfo> lineInfos = stop.getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(line -> new DisplayState.LineInfo(
                        line.getCode(),
                        line.getName(),
                        line.getColor()
                ))
                .toList();

        // Get upcoming arrivals within 30-minute window, one per line (next departure only)
        LocalTime now = LocalTime.now();
        LocalTime windowEnd = now.plusMinutes(WINDOW_MINUTES);
        List<DisplayState.ArrivalInfo> arrivals = timedEntryRepository
                .findByStopIdAndTimeWindowWithRoute(stopId, now, windowEnd)
                .stream()
                // Group by line code, keeping only the first (earliest) departure per line
                .collect(Collectors.toMap(
                        entry -> entry.getRoute().getLine().getCode(),
                        Function.identity(),
                        (existing, replacement) -> existing, // Keep first occurrence (earliest time)
                        LinkedHashMap::new // Preserve insertion order
                ))
                .values()
                .stream()
                // Sort by departure time
                .sorted(Comparator.comparing(TimedEntry::getTime))
                .map(this::toArrivalInfo)
                .toList();

        // Get active messages for this stop (for all its lines)
        Instant instant = Instant.now();
        Set<UUID> lineIds = stop.getLines().stream()
                .map(Line::getId)
                .collect(Collectors.toSet());
        List<DisplayState.MessageInfo> messages = messageRepository
                .findActiveMessagesForStop(instant, lineIds, stopId)
                .stream()
                .limit(MAX_MESSAGES)
                .map(this::toMessageInfo)
                .toList();

        // Get and increment version
        long version = versionMap
                .computeIfAbsent(stopId, k -> new AtomicLong(0))
                .incrementAndGet();

        return new DisplayState(
                stopId,
                stop.getName(),
                lineInfos,
                arrivals,
                messages,
                version,
                Instant.now()
        );
    }

    private DisplayState.ArrivalInfo toArrivalInfo(TimedEntry entry) {
        Route route = entry.getRoute();
        Line line = route.getLine();
        DisplayState.LineInfo lineInfo = new DisplayState.LineInfo(
                line.getCode(),
                line.getName(),
                line.getColor()
        );
        return new DisplayState.ArrivalInfo(
                entry.getTime(),
                route.getTerminusName(),
                lineInfo
        );
    }

    private DisplayState.MessageInfo toMessageInfo(BroadcastMessage message) {
        return new DisplayState.MessageInfo(
                message.getTitle(),
                message.getContent(),
                message.getSeverity()
        );
    }
}
