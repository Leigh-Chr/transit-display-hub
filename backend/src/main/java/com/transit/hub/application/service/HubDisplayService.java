package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.HubDisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.atomic.AtomicLong;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class HubDisplayService {

    private final DisplayStateCalculator displayStateCalculator;
    private final StopRepository stopRepository;
    private final Clock clock;
    /**
     * One monotonic counter per hub name. The previous shared
     * {@link AtomicLong} meant two hubs polling concurrently saw an
     * unstable global ordering, breaking the "drop stale frames"
     * filter on the frontend (a frame from hub A could end up with a
     * lower version than the frame the same hub had received earlier).
     */
    private final ConcurrentMap<String, AtomicLong> versionCountersByHub = new ConcurrentHashMap<>();

    private static final int MAX_MESSAGES = 5;
    private static final int MAX_ARRIVALS = 50;

    @Transactional(readOnly = true)
    public HubDisplayState getHubDisplayState(List<UUID> stopIds, String hubName) {
        // One filtering query instead of one existsById per stop: keep the
        // ids that actually map to a row, skip the rest. Stops missing
        // from the result get debug-logged (typo / stale URL / deleted
        // stop should not fail the whole hub).
        Set<UUID> existing = Set.copyOf(stopRepository.findExistingIdsIn(stopIds));
        List<DisplayState> stopStates = new ArrayList<>(existing.size());
        for (UUID stopId : stopIds) {
            if (!existing.contains(stopId)) {
                log.debug("Hub '{}' references unknown stop {}, skipping", hubName, stopId);
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
                                // Prefer the per-arrival platform_code (Phase 1.3:
                                // a parent-station stop aggregates multiple
                                // platforms with different codes), then the
                                // stop's overall platform_code, then the human
                                // stop name (typical for bus hubs without
                                // numbered platforms).
                                a.platformCode() != null && !a.platformCode().isBlank()
                                        ? a.platformCode()
                                        : (s.stopPlatformCode() != null && !s.stopPlatformCode().isBlank()
                                                ? s.stopPlatformCode()
                                                : s.stopName()),
                                a.line(),
                                a.pickupKind(),
                                a.wheelchairAccessible(),
                                a.bikesAllowed(),
                                a.timepoint(),
                                a.frequencyHeadwaySeconds(),
                                a.realtimeDelaySeconds(),
                                a.booking()
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

        AtomicLong counter = versionCountersByHub.computeIfAbsent(hubName, k -> new AtomicLong(0));
        return new HubDisplayState(
                hubName,
                lines,
                arrivals,
                messages,
                counter.incrementAndGet(),
                Instant.now(clock)
        );
    }
}
