package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.util.StopZoneResolver;
import com.transit.hub.domain.event.StopDeletedEvent;
import com.transit.hub.domain.util.ServiceCalendarMatcher;
import com.transit.hub.domain.util.TranslationLookup;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
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
    private final ServiceCalendarCache serviceCalendarCache;
    private final TranslationRepository translationRepository;
    private final ArrivalEnricher arrivalEnricher;
    private final RealtimeAlertMatcher realtimeAlertMatcher;
    /** Indirected so tests can pin "now" via Clock.fixed and not depend
     *  on wall-clock time. Production wires the system default-zone
     *  clock through {@link com.transit.hub.infrastructure.config.ClockConfig}. */
    private final Clock clock;

    /** Operator-facing zone used to compare wall-clock schedule times against
     *  the server's now(). Pinning it here means the JVM's TZ — which can be
     *  UTC in Docker — never silently shifts the kiosk's "next departure".
     *  When a stop's lines declare an {@code agency.timezone}, that takes
     *  precedence over this value; the property is the system-wide fallback
     *  for installs without GTFS data or without {@code agency.txt}. */
    @Value("${app.timezone:Europe/Paris}")
    private String appTimezone = "Europe/Paris";

    /** BCP-47 tag (e.g. {@code "fr"}, {@code "en-GB"}) used to look up
     *  GTFS translations. Empty (default) means the kiosk renders the
     *  feed's primary language as-is — backwards compatible with every
     *  install up to Phase 4.2. The single global value matches the
     *  kiosk hardware reality: each screen runs in one language. */
    @Value("${app.translations.preferred-language:}")
    private String preferredLanguage = "";

    private static final int MAX_MESSAGES = 3;
    private static final int WINDOW_MINUTES = 30;

    // Version tracking per stop
    private final Map<UUID, AtomicLong> versionMap = new ConcurrentHashMap<>();

    @Transactional(readOnly = true)
    public DisplayState calculateForStop(UUID stopId) {
        Stop stop = stopRepository.findByIdActiveWithLines(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        // Pull translations for the kiosk's preferred language once per
        // calculation. Empty (no language configured, or no rows in the
        // table) collapses to a no-op lookup, so the install behaves
        // identically to pre-Phase-4.2 when no translations exist.
        TranslationLookup translations = loadTranslations();

        // Get all lines info for this stop
        List<LineInfo> lineInfos = stop.getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(line -> ArrivalEnricher.translatedLineInfo(line, translations))
                .toList();

        // Get upcoming arrivals within 30-minute window, one per itinerary/direction.
        // Handles the midnight wrap (e.g., 23:50 → 00:20) by issuing two queries
        // concatenated in chronological order — see `loadUpcomingSchedules`.
        ZoneId zone = resolveZone(stop);
        Clock zonedClock = clock.withZone(zone);
        LocalTime now = LocalTime.now(zonedClock);
        LocalDate today = LocalDate.now(zonedClock);
        LocalTime windowEnd = now.plusMinutes(WINDOW_MINUTES);
        boolean crossesMidnight = !windowEnd.isAfter(now);

        // Pre-load every calendar with its exceptions in a single query so the
        // per-schedule isActive() check stays in memory. Bounded to ~10-20
        // calendars in practice; the find-all-with-exceptions repo method
        // avoids the 1+N "fetch exceptions per schedule" trap.
        Map<UUID, ServiceCalendar> calendarsById = loadCalendarsById();

        // Parent-station aggregation: a kiosk bound to a station with
        // children pulls every child's schedules in addition to its
        // own. Existing devices anchored to a previously-collapsed
        // parent station keep showing the same arrivals after the
        // platforms split out into their own rows. Free-standing
        // platforms (location_type=0) and stops without children skip
        // the extra query — `findChildIds` returns empty.
        Set<UUID> targetStopIds = new HashSet<>();
        targetStopIds.add(stopId);
        if (stop.getLocationType() == 1) {
            targetStopIds.addAll(stopRepository.findChildIds(stopId));
        }
        List<Schedule> upcoming = loadUpcomingSchedules(targetStopIds, now, windowEnd);
        // Filter on the service calendar of the day each schedule actually
        // belongs to: schedules pulled from the cross-midnight tail belong
        // to tomorrow's calendar, the rest to today's. Also drop
        // schedules whose realtime update marks them as SKIPPED — the
        // operator pulled the trip and we shouldn't show a phantom
        // departure.
        LocalDate tomorrow = today.plusDays(1);
        List<Schedule> activeToday = new ArrayList<>(upcoming.size());
        for (Schedule s : upcoming) {
            LocalDate effectiveDate = (crossesMidnight && s.getTime().isBefore(now)) ? tomorrow : today;
            ServiceCalendar calendar = resolveCalendar(s, calendarsById);
            if (!ServiceCalendarMatcher.isActive(calendar, effectiveDate)) {
                continue;
            }
            if (arrivalEnricher.isRealtimeSkipped(s)) {
                continue;
            }
            activeToday.add(s);
        }

        List<DisplayState.ArrivalInfo> arrivals = activeToday.stream()
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
                .map(s -> arrivalEnricher.toArrivalInfo(s, stopId, translations))
                .toList();

        // Get active messages for this stop (for all its lines)
        Instant instant = clock.instant();
        Set<UUID> lineIds = stop.getLines().stream()
                .map(Line::getId)
                .collect(Collectors.toSet());
        List<DisplayState.MessageInfo> persistedMessages = messageRepository
                .findActiveMessagesForStop(instant, lineIds, stopId)
                .stream()
                .map(this::toMessageInfo)
                .toList();
        // GTFS-RT alerts overlay: persisted broadcast messages already
        // count toward MAX_MESSAGES, the realtime alerts append
        // until we hit the cap. Realtime alerts come from a different
        // operator surface (the agency's alerts API rather than the
        // local admin), so we keep them visually distinct by appending
        // — the kiosk renders them with the same styling as broadcast
        // alerts of equivalent severity.
        List<DisplayState.MessageInfo> realtimeMessages =
                buildRealtimeMessages(stop, instant);
        List<DisplayState.MessageInfo> messages = new ArrayList<>(MAX_MESSAGES);
        for (DisplayState.MessageInfo m : persistedMessages) {
            if (messages.size() >= MAX_MESSAGES) {break;}
            messages.add(m);
        }
        for (DisplayState.MessageInfo m : realtimeMessages) {
            if (messages.size() >= MAX_MESSAGES) {break;}
            messages.add(m);
        }

        // Get and increment version
        long version = versionMap
                .computeIfAbsent(stopId, k -> new AtomicLong(0))
                .incrementAndGet();

        return new DisplayState(
                stopId,
                translations.resolveOr("stops", stop.getExternalId(), "stop_name", stop.getName()),
                stop.getPlatformCode(),
                stop.getShortCode(),
                lineInfos,
                arrivals,
                messages,
                version,
                clock.instant()
        );
    }

    /**
     * Pulls active GTFS-RT alerts that target the stop or any of its
     * lines / agencies, and converts them to {@link DisplayState.MessageInfo}.
     * Bridge kept so the existing call chain keeps working — delegates
     * to {@link RealtimeAlertMatcher#buildRealtimeMessages(Stop, Instant)}.
     */
    private List<DisplayState.MessageInfo> buildRealtimeMessages(Stop stop, Instant now) {
        return realtimeAlertMatcher.buildRealtimeMessages(stop, now);
    }

    private TranslationLookup loadTranslations() {
        if (preferredLanguage == null || preferredLanguage.isBlank()) {
            return TranslationLookup.empty();
        }
        return TranslationLookup.from(translationRepository.findByLanguage(preferredLanguage.trim()));
    }

    private Map<UUID, ServiceCalendar> loadCalendarsById() {
        return serviceCalendarCache.loadAll();
    }

    /**
     * Resolves a schedule's service calendar through the pre-loaded map so we
     * never hit Hibernate's lazy proxy. Schedules with a null FK (admin or
     * legacy rows that predate Phase 1.4) keep showing every day, which the
     * matcher handles via its {@code calendar == null} branch.
     */
    private static ServiceCalendar resolveCalendar(Schedule schedule, Map<UUID, ServiceCalendar> calendarsById) {
        ServiceCalendar lazy = schedule.getServiceCalendar();
        if (lazy == null) {
            return null;
        }
        // .getId() is safe on a LAZY proxy — Hibernate stores the FK locally.
        return calendarsById.get(lazy.getId());
    }

    private List<Schedule> loadUpcomingSchedules(Set<UUID> stopIds,
                                                  LocalTime now, LocalTime windowEnd) {
        // Single-element fast path uses the original = comparison
        // instead of IN; saves one planning step on the hot path
        // (most kiosks bind to a single platform).
        boolean singleStop = stopIds.size() == 1;
        UUID singleId = singleStop ? stopIds.iterator().next() : null;
        if (windowEnd.isAfter(now)) {
            return singleStop
                    ? scheduleRepository.findByStopIdAndTimeWindowWithItinerary(singleId, now, windowEnd)
                    : scheduleRepository.findByStopIdsAndTimeWindowWithItinerary(stopIds, now, windowEnd);
        }
        // Window crosses midnight: union of "after now today" and "up to windowEnd tomorrow"
        List<Schedule> beforeMidnight = singleStop
                ? scheduleRepository.findByStopIdAndTimeAfterWithItinerary(singleId, now)
                : scheduleRepository.findByStopIdsAndTimeAfterWithItinerary(stopIds, now);
        List<Schedule> afterMidnight = singleStop
                ? scheduleRepository.findByStopIdAndTimeBeforeOrEqualWithItinerary(singleId, windowEnd)
                : scheduleRepository.findByStopIdsAndTimeBeforeOrEqualWithItinerary(stopIds, windowEnd);
        List<Schedule> combined = new ArrayList<>(beforeMidnight.size() + afterMidnight.size());
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
     *   <li>The stop's own {@code stop_timezone} when set (rare but
     *       allowed for transit networks crossing zones).</li>
     *   <li>The {@code agency.timezone} of the most-served line (the line
     *       with the highest stop-line count); ties broken by line code
     *       so the resolution is deterministic.</li>
     *   <li>The first non-blank {@code agency.timezone} encountered.</li>
     *   <li>The {@code app.timezone} property — kept as a global fallback
     *       for installs whose feed has no {@code agency.txt}.</li>
     * </ol>
     * Invalid timezone strings (legacy or typo'd) silently fall through to
     * the next step rather than throwing, so a single bad row in the feed
     * cannot take a kiosk offline.
     */
    private ZoneId resolveZone(Stop stop) {
        return StopZoneResolver.resolveZone(stop, appTimezone);
    }
}
