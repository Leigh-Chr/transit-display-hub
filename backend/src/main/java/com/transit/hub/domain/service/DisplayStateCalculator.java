package com.transit.hub.domain.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
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
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

@Service
@RequiredArgsConstructor
public class DisplayStateCalculator {

    private final StopRepository stopRepository;
    private final TimedEntryRepository timedEntryRepository;
    private final BroadcastMessageRepository messageRepository;

    private static final int MAX_ARRIVALS = 5;
    private static final int MAX_MESSAGES = 3;

    // Version tracking per stop
    private final Map<UUID, AtomicLong> versionMap = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public DisplayState calculateForStop(UUID stopId) {
        Stop stop = stopRepository.findById(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        // Get line info
        DisplayState.LineInfo lineInfo = new DisplayState.LineInfo(
                stop.getLine().getCode(),
                stop.getLine().getName(),
                stop.getLine().getColor()
        );

        // Get upcoming arrivals (filter past times, limit to MAX_ARRIVALS)
        LocalTime now = LocalTime.now();
        List<DisplayState.ArrivalInfo> arrivals = timedEntryRepository
                .findByStopIdAndTimeAfter(stopId, now)
                .stream()
                .limit(MAX_ARRIVALS)
                .map(entry -> toArrivalInfo(entry, lineInfo))
                .toList();

        // Get active messages for this stop
        Instant instant = Instant.now();
        List<DisplayState.MessageInfo> messages = messageRepository
                .findActiveMessagesForStop(instant, stop.getLine().getId(), stopId)
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
                lineInfo,
                arrivals,
                messages,
                version,
                Instant.now()
        );
    }

    private DisplayState.ArrivalInfo toArrivalInfo(TimedEntry entry, DisplayState.LineInfo lineInfo) {
        // For MVP, all arrivals are for the same line as the stop
        // Destination could be derived from line name or a future field
        return new DisplayState.ArrivalInfo(
                entry.getTime(),
                lineInfo.name(), // Using line name as destination for now
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
