package com.transit.hub.domain.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.event.StopDeletedEvent;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
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
    private final ScheduleRepository scheduleRepository;
    private final BroadcastMessageRepository messageRepository;

    /** Operator-facing zone used to compare wall-clock schedule times against
     *  the server's now(). Pinning it here means the JVM's TZ — which can be
     *  UTC in Docker — never silently shifts the kiosk's "next departure".
     *  When a stop's lines declare an {@code agency.timezone}, that takes
     *  precedence over this value; the property is the system-wide fallback
     *  for installs without GTFS data or without {@code agency.txt}. */
    @Value("${app.timezone:Europe/Paris}")
    private String appTimezone = "Europe/Paris";

    private static final int MAX_MESSAGES = 3;
    private static final int WINDOW_MINUTES = 30;

    // Version tracking per stop
    private final Map<UUID, AtomicLong> versionMap = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public DisplayState calculateForStop(UUID stopId) {
        Stop stop = stopRepository.findByIdWithLines(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        // Get all lines info for this stop
        List<LineInfo> lineInfos = stop.getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(LineInfo::from)
                .toList();

        // Get upcoming arrivals within 30-minute window, one per itinerary/direction.
        // Handles the midnight wrap (e.g., 23:50 → 00:20) by issuing two queries
        // concatenated in chronological order — see `loadUpcomingSchedules`.
        ZoneId zone = resolveZone(stop);
        LocalTime now = LocalTime.now(zone);
        LocalTime windowEnd = now.plusMinutes(WINDOW_MINUTES);
        List<DisplayState.ArrivalInfo> arrivals = loadUpcomingSchedules(stopId, now, windowEnd)
                .stream()
                // Group by itinerary, keeping the first (earliest) departure per direction.
                // LinkedHashMap preserves insertion order, which already reflects chronology
                // (incl. cross-midnight), so no further sorting is needed.
                .collect(Collectors.toMap(
                        schedule -> schedule.getItinerary().getId(),
                        Function.identity(),
                        (existing, replacement) -> existing,
                        LinkedHashMap::new
                ))
                .values()
                .stream()
                .map(s -> toArrivalInfo(s, stopId))
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

    private List<Schedule> loadUpcomingSchedules(UUID stopId, LocalTime now, LocalTime windowEnd) {
        if (windowEnd.isAfter(now)) {
            return scheduleRepository.findByStopIdAndTimeWindowWithItinerary(stopId, now, windowEnd);
        }
        // Window crosses midnight: union of "after now today" and "up to windowEnd tomorrow"
        List<Schedule> beforeMidnight = scheduleRepository.findByStopIdAndTimeAfterWithItinerary(stopId, now);
        List<Schedule> afterMidnight = scheduleRepository.findByStopIdAndTimeBeforeOrEqualWithItinerary(stopId, windowEnd);
        List<Schedule> combined = new java.util.ArrayList<>(beforeMidnight.size() + afterMidnight.size());
        combined.addAll(beforeMidnight);
        combined.addAll(afterMidnight);
        return combined;
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStopDeleted(StopDeletedEvent event) {
        // Drop the version counter only after the deletion actually committed.
        // Using a plain @EventListener fired even on rollback, leaving the map
        // pruned for a stop the database still has (and pushing version=1
        // afterwards, which the kiosk's monotonicity filter would then reject).
        versionMap.remove(event.getStopId());
    }

    private DisplayState.ArrivalInfo toArrivalInfo(Schedule schedule, UUID stopId) {
        Itinerary itinerary = schedule.getItinerary();
        LineInfo lineInfo = LineInfo.from(itinerary.getLine());
        // stop_headsign overrides the trip-level terminus when the feed
        // declares a stop-specific destination (loop services, terminus
        // short-running, branching). Falls through to the itinerary's
        // terminus name on null/blank.
        String destination = resolveStopHeadsign(itinerary, stopId);
        if (destination == null) {
            destination = itinerary.getTerminusName();
        }
        return new DisplayState.ArrivalInfo(
                schedule.getTime(),
                destination,
                lineInfo
        );
    }

    private static String resolveStopHeadsign(Itinerary itinerary, UUID stopId) {
        if (itinerary.getItineraryStops() == null) {return null;}
        for (var is : itinerary.getItineraryStops()) {
            if (is.getStop() != null && stopId.equals(is.getStop().getId())) {
                String headsign = is.getStopHeadsign();
                return (headsign == null || headsign.isBlank()) ? null : headsign;
            }
        }
        return null;
    }

    private DisplayState.MessageInfo toMessageInfo(BroadcastMessage message) {
        return new DisplayState.MessageInfo(
                message.getTitle(),
                message.getContent(),
                message.getSeverity()
        );
    }

    /**
     * Resolves the operating timezone for a stop. Order of precedence:
     * <ol>
     *   <li>The {@code agency.timezone} of the most-served line (the line
     *       with the highest stop-line count); ties broken by line code
     *       so the resolution is deterministic.</li>
     *   <li>The first non-blank {@code agency.timezone} encountered.</li>
     *   <li>The {@code app.timezone} property — kept as a global fallback
     *       for synthetic-seed installs and feeds without {@code agency.txt}.</li>
     * </ol>
     * Invalid timezone strings (legacy or typo'd) silently fall through to
     * the next step rather than throwing, so a single bad row in the feed
     * cannot take a kiosk offline.
     */
    private ZoneId resolveZone(Stop stop) {
        Set<Line> lines = stop.getLines();
        if (lines != null && !lines.isEmpty()) {
            ZoneId fromAgency = lines.stream()
                    .filter(l -> l.getAgency() != null && l.getAgency().getTimezone() != null)
                    .sorted(Comparator
                            .comparing((Line l) -> l.getCode() == null ? "" : l.getCode()))
                    .map(l -> tryParseZone(l.getAgency().getTimezone()))
                    .filter(z -> z != null)
                    .findFirst()
                    .orElse(null);
            if (fromAgency != null) {
                return fromAgency;
            }
        }
        ZoneId fallback = tryParseZone(appTimezone);
        return fallback != null ? fallback : ZoneId.of("Europe/Paris");
    }

    private static ZoneId tryParseZone(String zone) {
        if (zone == null || zone.isBlank()) {
            return null;
        }
        try {
            return ZoneId.of(zone.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
