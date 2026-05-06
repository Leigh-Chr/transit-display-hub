package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.HubDisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.domain.service.DisplayStateCalculator;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HubDisplayService {

    private final DisplayStateCalculator displayStateCalculator;
    private final StopRepository stopRepository;
    private final AtomicLong versionCounter = new AtomicLong(0);

    private static final int MAX_MESSAGES = 5;
    private static final int MAX_ARRIVALS = 50;

    @Transactional(readOnly = true)
    public HubDisplayState getHubDisplayState(List<UUID> stopIds, String hubName) {
        // Skip individual stops that no longer exist instead of failing the whole hub.
        // A typo, a stale URL or a deleted stop should leave the rest of the hub usable.
        // We pre-filter via existsById to avoid letting EntityNotFoundException leak out
        // of calculateForStop — even when caught, an exception in a child @Transactional
        // marks the parent transaction as rollback-only.
        List<DisplayState> stopStates = new ArrayList<>(stopIds.size());
        for (UUID stopId : stopIds) {
            if (!stopRepository.existsById(stopId)) {
                if (log.isDebugEnabled()) {
                    log.debug("Hub '{}' references unknown stop {}, skipping", hubName, stopId);
                }
                continue;
            }
            stopStates.add(displayStateCalculator.calculateForStop(stopId));
        }

        // Merge lines, deduplicate by id, sort by code
        List<LineInfo> lines = stopStates.stream()
                .flatMap(s -> s.lines().stream())
                .collect(Collectors.toCollection(LinkedHashSet::new))
                .stream()
                .sorted(Comparator.comparing(LineInfo::code))
                .toList();

        // Merge arrivals with platform = stopName, sort by scheduledTime, cap to MAX_ARRIVALS
        List<HubDisplayState.HubArrivalInfo> arrivals = stopStates.stream()
                .flatMap(s -> s.arrivals().stream()
                        .map(a -> new HubDisplayState.HubArrivalInfo(
                                a.scheduledTime(),
                                a.destinationName(),
                                s.stopName(),
                                a.line(),
                                a.pickupKind()
                        )))
                .sorted(Comparator.comparing(HubDisplayState.HubArrivalInfo::scheduledTime))
                .limit(MAX_ARRIVALS)
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
