package com.transit.hub.domain.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.event.StopDeletedEvent;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.util.ServiceCalendarMatcher;
import com.transit.hub.domain.util.TranslationLookup;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import com.transit.hub.infrastructure.realtime.RealtimeTripUpdateCache;
import com.google.transit.realtime.GtfsRealtime;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.Comparator;
import java.util.HashMap;
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
    private final ServiceCalendarRepository serviceCalendarRepository;
    private final TranslationRepository translationRepository;
    private final RealtimeAlertCache realtimeAlertCache;
    private final RealtimeTripUpdateCache realtimeTripUpdateCache;

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
        Stop stop = stopRepository.findByIdWithLines(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        // Pull translations for the kiosk's preferred language once per
        // calculation. Empty (no language configured, or no rows in the
        // table) collapses to a no-op lookup, so the install behaves
        // identically to pre-Phase-4.2 when no translations exist.
        TranslationLookup translations = loadTranslations();

        // Get all lines info for this stop
        List<LineInfo> lineInfos = stop.getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(line -> translatedLineInfo(line, translations))
                .toList();

        // Get upcoming arrivals within 30-minute window, one per itinerary/direction.
        // Handles the midnight wrap (e.g., 23:50 → 00:20) by issuing two queries
        // concatenated in chronological order — see `loadUpcomingSchedules`.
        ZoneId zone = resolveZone(stop);
        LocalTime now = LocalTime.now(zone);
        LocalDate today = LocalDate.now(zone);
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
        java.util.Set<UUID> targetStopIds = new java.util.HashSet<>();
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
        List<Schedule> activeToday = new java.util.ArrayList<>(upcoming.size());
        for (Schedule s : upcoming) {
            LocalDate effectiveDate = (crossesMidnight && s.getTime().isBefore(now)) ? tomorrow : today;
            ServiceCalendar calendar = resolveCalendar(s, calendarsById);
            if (!ServiceCalendarMatcher.isActive(calendar, effectiveDate)) {
                continue;
            }
            if (isRealtimeSkipped(s)) {
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
                .map(s -> toArrivalInfo(s, stopId, translations))
                .toList();

        // Get active messages for this stop (for all its lines)
        Instant instant = Instant.now();
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
        List<DisplayState.MessageInfo> messages = new java.util.ArrayList<>(MAX_MESSAGES);
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
                Instant.now()
        );
    }

    /**
     * Pulls active GTFS-RT alerts that target the stop or any of its
     * lines / agencies, and converts them to {@link DisplayState.MessageInfo}.
     * The match uses {@code external_id} on both ends because the
     * realtime feed identifies entities by their GTFS ids, not by our
     * UUIDs.
     */
    private List<DisplayState.MessageInfo> buildRealtimeMessages(Stop stop, Instant now) {
        List<RealtimeAlertCache.AlertSnapshot> alerts = realtimeAlertCache.activeAlerts(now);
        if (alerts.isEmpty()) {
            return List.of();
        }
        String stopExternalId = stop.getExternalId();
        Set<String> lineExternalIds = new java.util.HashSet<>();
        Set<String> agencyExternalIds = new java.util.HashSet<>();
        for (Line l : stop.getLines()) {
            if (l.getExternalId() != null) {lineExternalIds.add(l.getExternalId());}
            if (l.getAgency() != null && l.getAgency().getExternalId() != null) {
                agencyExternalIds.add(l.getAgency().getExternalId());
            }
        }
        List<DisplayState.MessageInfo> result = new java.util.ArrayList<>();
        for (RealtimeAlertCache.AlertSnapshot a : alerts) {
            if (!matchesStop(a, stopExternalId, lineExternalIds, agencyExternalIds)) {
                continue;
            }
            String header = a.headerText();
            String description = a.descriptionText();
            // Skip alerts with no usable text — kiosks can't render
            // anything meaningful from a header-less alert.
            if ((header == null || header.isBlank())
                    && (description == null || description.isBlank())) {
                continue;
            }
            result.add(new DisplayState.MessageInfo(
                    header == null || header.isBlank() ? "Alerte" : header,
                    description == null ? "" : description,
                    severityFromAlert(a)
            ));
        }
        return result;
    }

    private static boolean matchesStop(RealtimeAlertCache.AlertSnapshot a,
                                       String stopExternalId,
                                       Set<String> lineExternalIds,
                                       Set<String> agencyExternalIds) {
        // Empty informed_entity means "applies to the whole network";
        // treat as a network-wide alert that surfaces everywhere.
        boolean noTargets = a.routeExternalIds().isEmpty()
                && a.stopExternalIds().isEmpty()
                && a.agencyExternalIds().isEmpty();
        if (noTargets) {return true;}
        if (stopExternalId != null && a.stopExternalIds().contains(stopExternalId)) {return true;}
        for (String lineId : lineExternalIds) {
            if (a.routeExternalIds().contains(lineId)) {return true;}
        }
        for (String agencyId : agencyExternalIds) {
            if (a.agencyExternalIds().contains(agencyId)) {return true;}
        }
        return false;
    }

    /**
     * Maps GTFS-RT severity to our three-state {@link MessageSeverity}.
     * When the feed leaves severity unset, we infer from {@code effect}
     * — {@code NO_SERVICE} on a line maps to CRITICAL, partial
     * disruptions to WARNING, the rest to INFO.
     */
    private static MessageSeverity severityFromAlert(RealtimeAlertCache.AlertSnapshot a) {
        GtfsRealtime.Alert.SeverityLevel level = a.severity();
        if (level == GtfsRealtime.Alert.SeverityLevel.SEVERE) {return MessageSeverity.CRITICAL;}
        if (level == GtfsRealtime.Alert.SeverityLevel.WARNING) {return MessageSeverity.WARNING;}
        if (level == GtfsRealtime.Alert.SeverityLevel.INFO) {return MessageSeverity.INFO;}
        // UNKNOWN_SEVERITY → fall back to effect inference
        GtfsRealtime.Alert.Effect effect = a.effect();
        return switch (effect) {
            case NO_SERVICE, STOP_MOVING -> MessageSeverity.CRITICAL;
            case REDUCED_SERVICE, SIGNIFICANT_DELAYS, DETOUR, ACCESSIBILITY_ISSUE,
                 MODIFIED_SERVICE -> MessageSeverity.WARNING;
            default -> MessageSeverity.INFO;
        };
    }

    private TranslationLookup loadTranslations() {
        if (preferredLanguage == null || preferredLanguage.isBlank()) {
            return TranslationLookup.empty();
        }
        return TranslationLookup.from(translationRepository.findByLanguage(preferredLanguage.trim()));
    }

    /**
     * Builds a {@link LineInfo} with {@code code} / {@code name} swapped
     * for their translated equivalents when the feed provides them. The
     * fallback is the original value, so a partially-translated feed
     * still renders without holes.
     */
    private static LineInfo translatedLineInfo(Line line, TranslationLookup translations) {
        if (translations.isEmpty()) {
            return LineInfo.from(line);
        }
        String code = translations.resolveOr("routes", line.getExternalId(), "route_short_name", line.getCode());
        String name = translations.resolveOr("routes", line.getExternalId(), "route_long_name", line.getName());
        return new LineInfo(line.getId(), code, name, line.getColor(), line.getTextColor());
    }

    /**
     * Resolves the itinerary's terminus name, applying the translation
     * for the underlying terminus stop when one exists. Used as the
     * final fallback for {@code destination} when neither a per-stop
     * {@code stop_headsign} nor a trip-level {@code trip_headsign}
     * translation is available.
     */
    private static String resolveTranslatedTerminus(Itinerary itinerary, TranslationLookup translations) {
        if (itinerary.getItineraryStops() == null || itinerary.getItineraryStops().isEmpty()) {
            return itinerary.getTerminusName();
        }
        Stop terminus = itinerary.getItineraryStops().getLast().getStop();
        if (terminus == null) {
            return itinerary.getTerminusName();
        }
        return translations.resolveOr("stops", terminus.getExternalId(), "stop_name", terminus.getName());
    }

    private Map<UUID, ServiceCalendar> loadCalendarsById() {
        Map<UUID, ServiceCalendar> map = new HashMap<>();
        for (ServiceCalendar cal : serviceCalendarRepository.findAllWithExceptions()) {
            map.put(cal.getId(), cal);
        }
        return map;
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

    private List<Schedule> loadUpcomingSchedules(java.util.Set<UUID> stopIds,
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

    private DisplayState.ArrivalInfo toArrivalInfo(Schedule schedule, UUID stopId,
                                                   TranslationLookup translations) {
        Itinerary itinerary = schedule.getItinerary();
        LineInfo lineInfo = translatedLineInfo(itinerary.getLine(), translations);
        // stop_headsign overrides the trip-level terminus when the feed
        // declares a stop-specific destination (loop services, terminus
        // short-running, branching). Falls through to the itinerary's
        // trip_headsign translation, then to the terminus name.
        String destination = resolveStopHeadsign(itinerary, stopId);
        if (destination == null) {
            destination = translations.resolveOr("trips", itinerary.getExternalId(), "trip_headsign",
                    resolveTranslatedTerminus(itinerary, translations));
        }
        // Realtime delay: positive = late, negative = early. The
        // scheduled time stays as-published; the kiosk applies the
        // delta itself so a "scheduled / live" comparison is possible.
        Integer delay = resolveRealtimeDelay(schedule);
        return new DisplayState.ArrivalInfo(
                schedule.getTime(),
                destination,
                lineInfo,
                com.transit.hub.domain.model.enums.PickupKind.from(
                        schedule.getPickupType(), schedule.getDropOffType()),
                resolveWheelchair(schedule, itinerary),
                resolveBikes(schedule, itinerary),
                schedule.isTimepoint(),
                schedule.getFrequencyHeadwaySeconds(),
                delay,
                resolveBookingInfo(schedule)
        );
    }

    /**
     * Looks the schedule up against the GTFS-RT trip-update cache.
     * Matching: itinerary's representative trip_id → trip-level
     * adjustment, then stop's external_id → stop-level adjustment.
     * The stop-level delay wins when both are present.
     */
    /**
     * Surfaces the schedule's pickup booking rule as a passenger DTO
     * — phone, URL, prior notice — when the arrival's pickup is
     * on-demand (TAD). Returns null on regular fixed-route arrivals
     * so the kiosk doesn't render a CTA where none applies.
     *
     * Drop-off bookings are intentionally not surfaced: a passenger
     * arriving at a stop has already booked, and rendering an
     * "alighting reservation" message at boarding time confuses more
     * than it helps.
     */
    private DisplayState.BookingInfo resolveBookingInfo(Schedule schedule) {
        com.transit.hub.domain.model.BookingRule rule = schedule.getPickupBookingRule();
        if (rule == null) {return null;}
        // Only surface when the pickup type signals "on-demand" — a
        // booking rule attached to a regular pickup_type=0 trip is
        // unusual but legal in the spec and shouldn't trigger a CTA.
        short pt = schedule.getPickupType();
        if (pt != 2 && pt != 3) {return null;}
        return new DisplayState.BookingInfo(
                rule.getPhone(),
                rule.getBookingUrl(),
                rule.getInfoUrl(),
                rule.getMessage(),
                rule.getPriorNoticeDurationMin());
    }

    private Integer resolveRealtimeDelay(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        if (itinerary.getExternalId() == null) {return null;}
        return realtimeTripUpdateCache.findUpdate(itinerary.getExternalId())
                .map(update -> {
                    String stopExternalId = schedule.getStop() != null
                            ? schedule.getStop().getExternalId() : null;
                    if (stopExternalId != null && update.byStopExternalId().containsKey(stopExternalId)) {
                        Integer perStop = update.byStopExternalId().get(stopExternalId).effectiveDelaySeconds();
                        if (perStop != null) {return perStop;}
                    }
                    return update.tripLevelDelaySeconds();
                })
                .orElse(null);
    }

    /**
     * True when the GTFS-RT feed marks this stop / trip pair as
     * skipped. The display calculator drops the schedule entirely so
     * the kiosk doesn't show a phantom departure.
     */
    private boolean isRealtimeSkipped(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        if (itinerary.getExternalId() == null) {return false;}
        String stopExternalId = schedule.getStop() != null
                ? schedule.getStop().getExternalId() : null;
        if (stopExternalId == null) {return false;}
        return realtimeTripUpdateCache.findUpdate(itinerary.getExternalId())
                .map(update -> {
                    var stopAdj = update.byStopExternalId().get(stopExternalId);
                    return stopAdj != null && stopAdj.skipped();
                })
                .orElse(false);
    }

    /**
     * Resolves the effective bikes-allowed policy for an arrival,
     * mirroring {@link #resolveWheelchair}.
     */
    private static com.transit.hub.domain.model.enums.BikesAllowed resolveBikes(
            Schedule schedule, Itinerary itinerary) {
        if (schedule.getBikesAllowedOverride() != null) {
            return schedule.getBikesAllowedOverride()
                    ? com.transit.hub.domain.model.enums.BikesAllowed.ALLOWED
                    : com.transit.hub.domain.model.enums.BikesAllowed.NOT_ALLOWED;
        }
        return itinerary.getBikesAllowedDefault() == null
                ? com.transit.hub.domain.model.enums.BikesAllowed.UNKNOWN
                : itinerary.getBikesAllowedDefault();
    }

    /**
     * Resolves the effective wheelchair accessibility for an arrival.
     * Priority: schedule override > itinerary default > UNKNOWN. Keeps
     * the kiosk three-state pictogram in sync with what the operator
     * actually published in the feed.
     */
    private static com.transit.hub.domain.model.enums.WheelchairAccess resolveWheelchair(
            Schedule schedule, Itinerary itinerary) {
        if (schedule.getWheelchairOverride() != null) {
            return schedule.getWheelchairOverride()
                    ? com.transit.hub.domain.model.enums.WheelchairAccess.ACCESSIBLE
                    : com.transit.hub.domain.model.enums.WheelchairAccess.NOT_ACCESSIBLE;
        }
        return itinerary.getWheelchairDefault() == null
                ? com.transit.hub.domain.model.enums.WheelchairAccess.UNKNOWN
                : itinerary.getWheelchairDefault();
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
     *   <li>The stop's own {@code stop_timezone} when set (rare but
     *       allowed for transit networks crossing zones).</li>
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
        ZoneId fromStop = tryParseZone(stop.getStopTimezone());
        if (fromStop != null) {
            return fromStop;
        }
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
