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
     *  UTC in Docker — never silently shifts the kiosk's "next departure". */
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
        LocalTime now = LocalTime.now(ZoneId.of(appTimezone));
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

    private DisplayState.ArrivalInfo toArrivalInfo(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        LineInfo lineInfo = LineInfo.from(itinerary.getLine());
        return new DisplayState.ArrivalInfo(
                schedule.getTime(),
                itinerary.getTerminusName(),
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
