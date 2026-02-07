package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.HubDisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.domain.service.DisplayStateCalculator;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class HubDisplayService {

    private final DisplayStateCalculator displayStateCalculator;
    private final AtomicLong versionCounter = new AtomicLong(0);

    private static final int MAX_MESSAGES = 5;

    @Transactional(readOnly = true)
    public HubDisplayState getHubDisplayState(List<UUID> stopIds, String hubName) {
        List<DisplayState> stopStates = stopIds.stream()
                .map(displayStateCalculator::calculateForStop)
                .toList();

        // Merge lines, deduplicate by id, sort by code
        List<LineInfo> lines = stopStates.stream()
                .flatMap(s -> s.lines().stream())
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .sorted(Comparator.comparing(LineInfo::code))
                .toList();

        // Merge arrivals with platform = stopName, sort by scheduledTime
        List<HubDisplayState.HubArrivalInfo> arrivals = stopStates.stream()
                .flatMap(s -> s.arrivals().stream()
                        .map(a -> new HubDisplayState.HubArrivalInfo(
                                a.scheduledTime(),
                                a.destinationName(),
                                s.stopName(),
                                a.line()
                        )))
                .sorted(Comparator.comparing(HubDisplayState.HubArrivalInfo::scheduledTime))
                .toList();

        // Deduplicate messages (records have structural equality), limit to MAX_MESSAGES
        List<DisplayState.MessageInfo> messages = stopStates.stream()
                .flatMap(s -> s.messages().stream())
                .distinct()
                .limit(MAX_MESSAGES)
                .toList();

        return new HubDisplayState(
                hubName,
                lines,
                arrivals,
                messages,
                versionCounter.incrementAndGet(),
                Instant.now()
        );
    }
}
