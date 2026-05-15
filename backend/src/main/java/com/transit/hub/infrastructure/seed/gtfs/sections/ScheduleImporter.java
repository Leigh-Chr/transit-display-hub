package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Location;
import com.transit.hub.domain.model.LocationGroup;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.ServiceCalendarException;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.ServiceExceptionType;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import com.transit.hub.infrastructure.persistence.LocationGroupRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsParse;
import com.transit.hub.infrastructure.seed.gtfs.model.FrequencyWindow;
import com.transit.hub.infrastructure.seed.gtfs.model.ItineraryImport;
import com.transit.hub.infrastructure.seed.gtfs.model.RouteDirKey;
import com.transit.hub.infrastructure.seed.gtfs.model.ServiceCalendarSnapshot;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import com.transit.hub.infrastructure.seed.gtfs.model.TripInfo;
import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseShortOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;
import static com.transit.hub.infrastructure.seed.gtfs.sections.ItineraryImporter.computeBikesOverride;
import static com.transit.hub.infrastructure.seed.gtfs.sections.ItineraryImporter.computeWheelchairOverride;

/**
 * Reads {@code stop_times.txt}, {@code calendar.txt}, {@code calendar_dates.txt},
 * and {@code frequencies.txt} to produce {@link Schedule} + {@link FlexStopTime}
 * rows. Must run after {@link ItineraryImporter} and {@link BookingRuleImporter}
 * so the FK references are already persisted.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ScheduleImporter {

    private static final int MAX_SCHEDULE_BATCH = 5_000;
    private static final long DAY_SECONDS = 24L * 3600L;

    private final ScheduleRepository scheduleRepository;
    private final ServiceCalendarRepository serviceCalendarRepository;
    private final FlexStopTimeRepository flexStopTimeRepository;
    private final LocationRepository locationRepository;
    private final LocationGroupRepository locationGroupRepository;

    /** Used to flush + detach each batch so the first-level cache doesn't
     *  retain every persisted Schedule across the whole import. Without
     *  this an Île-de-France-sized feed (~250 k schedules) keeps growing
     *  the persistence context until the import OOMs. */
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Reads {@code frequencies.txt} into a {@code tripId → List<FrequencyWindow>} map.
     * Absent file or missing required fields yield an empty list for that trip
     * (which the importer treats as "fixed timetable").
     */
    public Map<String, List<FrequencyWindow>> loadFrequencies(Path frequenciesFile) throws IOException {
        Map<String, List<FrequencyWindow>> result = new HashMap<>();
        if (!Files.exists(frequenciesFile)) {
            return result;
        }
        try (CSVParser parser = openCsv(frequenciesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                int headway = parseInt(optional(record, "headway_secs"), 0);
                LocalTime start = GtfsParse.parseGtfsTime(optional(record, "start_time"));
                LocalTime end = GtfsParse.parseGtfsTime(optional(record, "end_time"));
                if (isBlank(tripId) || headway <= 0 || start == null || end == null) { continue; }
                String exactRaw = optional(record, "exact_times");
                Boolean exact = isBlank(exactRaw) ? null : "1".equals(exactRaw.trim());
                result.computeIfAbsent(tripId, k -> new ArrayList<>())
                        .add(new FrequencyWindow(start, end, headway, exact));
            }
        }
        int totalWindows = result.values().stream().mapToInt(List::size).sum();
        log.info("GTFS import: {} trips carry frequency annotations across {} window(s)",
                result.size(), totalWindows);
        return result;
    }

    /**
     * Imports schedules and flex stop-times from {@code stop_times.txt}.
     * Wipes both target tables before re-importing. Must run after
     * {@link ItineraryImporter} and {@link BookingRuleImporter}.
     *
     * @return total number of {@link Schedule} rows persisted
     */
    public int importSchedules(Path workDir, ItineraryImport itineraryImport, StopImport stopImport,
                               Map<String, List<FrequencyWindow>> frequencies,
                               Map<String, BookingRule> bookingRules) throws IOException {
        Path stopTimesFile = workDir.resolve("stop_times.txt");
        if (!Files.exists(stopTimesFile)) {
            log.warn("GTFS import: stop_times.txt missing, skipping schedule import");
            return 0;
        }

        // Wipe the schedule tables before re-importing. See ADR 0013.
        scheduleRepository.deleteAllInBatch();
        scheduleRepository.flush();
        flexStopTimeRepository.deleteAllInBatch();
        flexStopTimeRepository.flush();

        Map<String, ServiceCalendarSnapshot> snapshots = loadServiceCalendars(workDir);
        if (snapshots.isEmpty()) {
            log.warn("GTFS import: no service calendars found, skipping schedule import");
            return 0;
        }
        Map<String, ServiceCalendar> services = persistServiceCalendars(snapshots);
        logReferenceDate(snapshots);

        // Fan-out anchor: every stop_time of a frequency-mode trip is replicated
        // for every (window, k) departure as windowStart + (stopTime - tripStart).
        ImportContext ctx = new ImportContext(
                indexLocationsByExternalId(),
                indexLocationGroupsByExternalId(),
                services,
                itineraryImport.tripInfos(),
                itineraryImport.itinerariesByRouteDir(),
                bookingRules,
                frequencies,
                loadTripStartTimes(stopTimesFile, frequencies.keySet()),
                stopImport);

        streamStopTimes(stopTimesFile, ctx);
        drainPendingBatches(ctx);

        if (ctx.skippedNoCalendar > 0) {
            log.warn("GTFS import: skipped {} stop_times rows whose trip references an unknown service_id",
                    ctx.skippedNoCalendar);
        }
        log.info("GTFS import: {} schedules + {} flex stop_times created across {} service calendars",
                ctx.total, ctx.flexTotal, services.size());
        return ctx.total;
    }

    private record ScheduleKey(UUID stopId, UUID itineraryId, LocalTime time, UUID calendarId) {}

    /** Bag of state threaded through {@link #importSchedules} and its
     *  per-row helpers — split out so the main loop body stays under
     *  PMD's cyclomatic threshold without losing the inline context. */
    private static final class ImportContext {
        final Set<ScheduleKey> seen = new HashSet<>();
        final List<Schedule> batch = new ArrayList<>(MAX_SCHEDULE_BATCH);
        final List<FlexStopTime> flexBatch = new ArrayList<>(MAX_SCHEDULE_BATCH);
        final Map<String, Location> locationsByExternalId;
        final Map<String, LocationGroup> locationGroupsByExternalId;
        final Map<String, ServiceCalendar> services;
        final Map<String, TripInfo> tripInfos;
        final Map<RouteDirKey, Itinerary> itineraries;
        final Map<String, BookingRule> bookingRules;
        final Map<String, List<FrequencyWindow>> frequencies;
        final Map<String, LocalTime> tripStartTimes;
        final StopImport stopImport;
        int total;
        int flexTotal;
        int skippedNoCalendar;

        ImportContext(Map<String, Location> locations,
                      Map<String, LocationGroup> locationGroups,
                      Map<String, ServiceCalendar> services,
                      Map<String, TripInfo> tripInfos,
                      Map<RouteDirKey, Itinerary> itineraries,
                      Map<String, BookingRule> bookingRules,
                      Map<String, List<FrequencyWindow>> frequencies,
                      Map<String, LocalTime> tripStartTimes,
                      StopImport stopImport) {
            this.locationsByExternalId = locations;
            this.locationGroupsByExternalId = locationGroups;
            this.services = services;
            this.tripInfos = tripInfos;
            this.itineraries = itineraries;
            this.bookingRules = bookingRules;
            this.frequencies = frequencies;
            this.tripStartTimes = tripStartTimes;
            this.stopImport = stopImport;
        }
    }

    private Map<String, Location> indexLocationsByExternalId() {
        return locationRepository.findAll().stream()
                .filter(l -> l.getExternalId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        Location::getExternalId,
                        java.util.function.Function.identity(),
                        (a, b) -> a));
    }

    private Map<String, LocationGroup> indexLocationGroupsByExternalId() {
        return locationGroupRepository.findAll().stream()
                .filter(l -> l.getExternalId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        LocationGroup::getExternalId,
                        java.util.function.Function.identity(),
                        (a, b) -> a));
    }

    private void streamStopTimes(Path stopTimesFile, ImportContext ctx) throws IOException {
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                handleRow(record, ctx);
            }
        }
    }

    private void handleRow(CSVRecord record, ImportContext ctx) {
        String tripId = record.get("trip_id");
        TripInfo trip = ctx.tripInfos.get(tripId);
        if (trip == null) {
            return;
        }
        ServiceCalendar calendar = ctx.services.get(trip.serviceId());
        if (calendar == null) {
            ctx.skippedNoCalendar++;
            return;
        }
        Itinerary itinerary = ctx.itineraries.get(new RouteDirKey(trip.routeId(), trip.directionId()));
        if (itinerary == null) {
            return;
        }
        if (handleFlexRowIfApplicable(record, itinerary, calendar, ctx)) {
            return;
        }
        handleFixedRow(record, tripId, trip, itinerary, calendar, ctx);
    }

    /** Returns true when the row was a GTFS-flex pickup/drop-off window
     *  and has been routed to the flex_stop_times bucket. The caller
     *  bails out without falling through to the fixed-schedule path. */
    private boolean handleFlexRowIfApplicable(CSVRecord record, Itinerary itinerary,
                                              ServiceCalendar calendar, ImportContext ctx) {
        LocalTime flexStartWindow = GtfsParse.parseGtfsTime(
                optional(record, "start_pickup_drop_off_window"));
        LocalTime flexEndWindow = GtfsParse.parseGtfsTime(
                optional(record, "end_pickup_drop_off_window"));
        if (flexStartWindow == null || flexEndWindow == null) {
            return false;
        }
        String flexLocationId = optional(record, "location_id");
        String flexLocationGroupId = optional(record, "location_group_id");
        String flexStopId = optional(record, "stop_id");
        LocalTime flexArrival = GtfsParse.parseGtfsTime(optional(record, "arrival_time"));
        boolean isFlexRow = !isBlank(flexLocationId)
                || !isBlank(flexLocationGroupId)
                || (!isBlank(flexStopId) && flexArrival == null);
        if (!isFlexRow) {
            return false;
        }
        ctx.flexBatch.add(buildFlexStopTime(record, itinerary, calendar,
                ctx.stopImport, ctx.locationsByExternalId, ctx.locationGroupsByExternalId,
                ctx.bookingRules, flexStartWindow, flexEndWindow));
        if (ctx.flexBatch.size() >= MAX_SCHEDULE_BATCH) {
            flexStopTimeRepository.saveAll(ctx.flexBatch);
            flushAndDetach(ctx.flexBatch);
            ctx.flexTotal += ctx.flexBatch.size();
            ctx.flexBatch.clear();
        }
        return true;
    }

    private void handleFixedRow(CSVRecord record, String tripId, TripInfo trip,
                                Itinerary itinerary, ServiceCalendar calendar, ImportContext ctx) {
        Stop stop = ctx.stopImport.stopsByGtfsId().get(record.get("stop_id"));
        if (stop == null) {
            return;
        }
        LocalTime arrivalTime = GtfsParse.parseGtfsTime(optional(record, "arrival_time"));
        LocalTime departureTime = GtfsParse.parseGtfsTime(optional(record, "departure_time"));
        LocalTime time = arrivalTime != null ? arrivalTime : departureTime;
        if (time == null) {
            return;
        }
        short pickupType = (short) parseInt(optional(record, "pickup_type"), 0);
        short dropOffType = (short) parseInt(optional(record, "drop_off_type"), 0);
        if (pickupType == 1 && dropOffType == 1) {
            return;
        }
        ScheduleRowContext row = new ScheduleRowContext(record, trip, itinerary, calendar, stop,
                time, departureTime, pickupType, dropOffType, ctx.bookingRules);
        List<FrequencyWindow> windows = ctx.frequencies.get(tripId);
        if (windows == null || windows.isEmpty()) {
            persistFixedSchedule(row, ctx);
        } else {
            expandFrequencyWindows(row, windows, ctx.tripStartTimes.get(tripId), ctx);
        }
    }

    /** Bundle of per-row fields plus a few lazy accessors that read the
     *  remaining CSV columns once. Keeps the two persistence helpers
     *  ({@link #persistFixedSchedule}, {@link #expandFrequencyWindows})
     *  short and identical in argument shape. */
    private record ScheduleRowContext(CSVRecord record, TripInfo trip, Itinerary itinerary,
                                      ServiceCalendar calendar, Stop stop,
                                      LocalTime time, LocalTime departureTime,
                                      short pickupType, short dropOffType,
                                      Map<String, BookingRule> bookingRules) {
        LocalTime distinctDeparture() {
            return (departureTime != null && !departureTime.equals(time)) ? departureTime : null;
        }
        Short continuousPickup() {
            return parseShortOrNull(optional(record, "continuous_pickup"));
        }
        Short continuousDropOff() {
            return parseShortOrNull(optional(record, "continuous_drop_off"));
        }
        Double shapeDistTraveled() {
            return parseDoubleOrNull(optional(record, "shape_dist_traveled"));
        }
        boolean timepoint() {
            String raw = optional(record, "timepoint");
            return isBlank(raw) || !"0".equals(raw.trim());
        }
        BookingRule pickupBooking() {
            return bookingRules.get(optional(record, "pickup_booking_rule_id"));
        }
        BookingRule dropOffBooking() {
            return bookingRules.get(optional(record, "drop_off_booking_rule_id"));
        }
        Boolean wheelchairOverride() {
            return computeWheelchairOverride(trip.wheelchairAccessible(),
                    itinerary.getWheelchairDefault()).orElse(null);
        }
        Boolean bikesOverride() {
            return computeBikesOverride(trip.bikesAllowed(),
                    itinerary.getBikesAllowedDefault()).orElse(null);
        }
    }

    private void persistFixedSchedule(ScheduleRowContext row, ImportContext ctx) {
        ScheduleKey key = new ScheduleKey(row.stop.getId(), row.itinerary.getId(),
                row.time, row.calendar.getId());
        if (!ctx.seen.add(key)) {
            return;
        }
        ctx.batch.add(Schedule.builder()
                .time(row.time)
                .departureTime(row.distinctDeparture())
                .stop(row.stop)
                .itinerary(row.itinerary)
                .pickupType(row.pickupType)
                .dropOffType(row.dropOffType)
                .wheelchairOverride(row.wheelchairOverride())
                .bikesAllowedOverride(row.bikesOverride())
                .timepoint(row.timepoint())
                .frequencyHeadwaySeconds(null)
                .frequencyExactTimes(null)
                .blockId(row.trip.blockId())
                .serviceCalendar(row.calendar)
                .pickupBookingRule(row.pickupBooking())
                .dropOffBookingRule(row.dropOffBooking())
                .continuousPickup(row.continuousPickup())
                .continuousDropOff(row.continuousDropOff())
                .shapeDistTraveled(row.shapeDistTraveled())
                .build());
        flushBatchIfFull(ctx);
    }

    private void expandFrequencyWindows(ScheduleRowContext row, List<FrequencyWindow> windows,
                                        LocalTime tripStart, ImportContext ctx) {
        if (tripStart == null) {
            return;
        }
        long deltaSeconds = ((long) row.time.toSecondOfDay() - tripStart.toSecondOfDay() + DAY_SECONDS)
                % DAY_SECONDS;
        for (FrequencyWindow window : windows) {
            long winStart = window.start().toSecondOfDay();
            long winEnd = window.end().toSecondOfDay();
            // Window crossing midnight: end falls earlier than start
            // because parseGtfsTime folds hours mod 24. Shift end up
            // by a full day so the iterator emits the right count.
            if (winEnd <= winStart) {
                winEnd += DAY_SECONDS;
            }
            for (long ts = winStart; ts < winEnd; ts += window.headwaySeconds()) {
                LocalTime stopTime = LocalTime.ofSecondOfDay((ts + deltaSeconds) % DAY_SECONDS);
                ScheduleKey key = new ScheduleKey(row.stop.getId(), row.itinerary.getId(),
                        stopTime, row.calendar.getId());
                if (!ctx.seen.add(key)) {
                    continue;
                }
                ctx.batch.add(Schedule.builder()
                        .time(stopTime)
                        .stop(row.stop)
                        .itinerary(row.itinerary)
                        .pickupType(row.pickupType)
                        .dropOffType(row.dropOffType)
                        .wheelchairOverride(row.wheelchairOverride())
                        .bikesAllowedOverride(row.bikesOverride())
                        .timepoint(row.timepoint())
                        .frequencyHeadwaySeconds(window.headwaySeconds())
                        .frequencyExactTimes(window.exactTimes())
                        .blockId(row.trip.blockId())
                        .serviceCalendar(row.calendar)
                        .pickupBookingRule(row.pickupBooking())
                        .dropOffBookingRule(row.dropOffBooking())
                        .continuousPickup(row.continuousPickup())
                        .continuousDropOff(row.continuousDropOff())
                        .shapeDistTraveled(row.shapeDistTraveled())
                        .build());
                flushBatchIfFull(ctx);
            }
        }
    }

    private void flushBatchIfFull(ImportContext ctx) {
        if (ctx.batch.size() >= MAX_SCHEDULE_BATCH) {
            scheduleRepository.saveAll(ctx.batch);
            flushAndDetach(ctx.batch);
            ctx.total += ctx.batch.size();
            ctx.batch.clear();
            log.debug("GTFS import: {} schedules persisted so far", ctx.total);
        }
    }

    private void drainPendingBatches(ImportContext ctx) {
        if (!ctx.batch.isEmpty()) {
            scheduleRepository.saveAll(ctx.batch);
            flushAndDetach(ctx.batch);
            ctx.total += ctx.batch.size();
        }
        if (!ctx.flexBatch.isEmpty()) {
            flexStopTimeRepository.saveAll(ctx.flexBatch);
            flushAndDetach(ctx.flexBatch);
            ctx.flexTotal += ctx.flexBatch.size();
        }
    }

    /** Drain pending inserts and evict the batch from the persistence
     *  context so the first-level cache stays bounded across hundreds
     *  of batches. The parent entities (itineraries, stops, calendars)
     *  remain managed because we only detach the rows we just saved. */
    private void flushAndDetach(List<?> entities) {
        entityManager.flush();
        for (Object entity : entities) {
            entityManager.detach(entity);
        }
    }

    // ---------- flex stop-time builder ----------

    /** Builds a {@link FlexStopTime} from a stop_times.txt row whose pickup/drop-off
     *  applies over a polygon (location_id) or a group of stops (location_group_id).
     *  Spec dictates the three target refs are mutually exclusive — we honour
     *  location_id over location_group_id over stop_id when more than one is set,
     *  but log nothing because feeds in the wild occasionally tag both for redundancy. */
    private FlexStopTime buildFlexStopTime(CSVRecord record, Itinerary itinerary,
                                           ServiceCalendar calendar,
                                           StopImport stopImport,
                                           Map<String, Location> locations,
                                           Map<String, LocationGroup> locationGroups,
                                           Map<String, BookingRule> bookingRules,
                                           LocalTime startWindow, LocalTime endWindow) {
        String locationId = optional(record, "location_id");
        String locationGroupId = optional(record, "location_group_id");
        String stopId = optional(record, "stop_id");
        Location location = isBlank(locationId) ? null : locations.get(locationId);
        LocationGroup locationGroup =
                (location == null && !isBlank(locationGroupId))
                        ? locationGroups.get(locationGroupId) : null;
        Stop stop = (location == null && locationGroup == null && !isBlank(stopId))
                ? stopImport.stopsByGtfsId().get(stopId) : null;

        Short pickupType = parseShortOrNull(optional(record, "pickup_type"));
        Short dropOffType = parseShortOrNull(optional(record, "drop_off_type"));
        BookingRule pickupBooking = bookingRules.get(optional(record, "pickup_booking_rule_id"));
        BookingRule dropOffBooking = bookingRules.get(optional(record, "drop_off_booking_rule_id"));
        Integer sequence = parseIntOrNull(optional(record, "stop_sequence"));

        return FlexStopTime.builder()
                .itinerary(itinerary)
                .stopSequence(sequence == null ? Integer.valueOf(0) : sequence)
                .stop(stop)
                .location(location)
                .locationGroup(locationGroup)
                .startPickupDropOffWindow(startWindow)
                .endPickupDropOffWindow(endWindow)
                .pickupType(pickupType)
                .dropOffType(dropOffType)
                .pickupBookingRule(pickupBooking)
                .dropOffBookingRule(dropOffBooking)
                .serviceCalendar(calendar)
                .stopHeadsign(truncate(optional(record, "stop_headsign"), 100))
                .build();
    }

    // ---------- calendar helpers ----------

    /**
     * Persists each {@link ServiceCalendarSnapshot} as a {@link ServiceCalendar}
     * row plus its {@link ServiceCalendarException}s. Wipes the existing calendar
     * tables first so re-imports start from a clean slate.
     */
    private Map<String, ServiceCalendar> persistServiceCalendars(
            Map<String, ServiceCalendarSnapshot> snapshots) {
        serviceCalendarRepository.deleteAllInBatch();
        serviceCalendarRepository.flush();

        Map<String, ServiceCalendar> result = new HashMap<>();
        for (Map.Entry<String, ServiceCalendarSnapshot> e : snapshots.entrySet()) {
            String externalId = e.getKey();
            ServiceCalendarSnapshot snap = e.getValue();
            ServiceCalendar entity = ServiceCalendar.builder()
                    .externalId(truncate(externalId, 100))
                    .startDate(snap.startDate())
                    .endDate(snap.endDate())
                    .build();
            entity.setDaysOfWeek(snap.daysOfWeek());
            for (LocalDate d : snap.addedDates()) {
                entity.getExceptions().add(ServiceCalendarException.builder()
                        .serviceCalendar(entity)
                        .date(d)
                        .exceptionType(ServiceExceptionType.ADDED)
                        .build());
            }
            for (LocalDate d : snap.removedDates()) {
                entity.getExceptions().add(ServiceCalendarException.builder()
                        .serviceCalendar(entity)
                        .date(d)
                        .exceptionType(ServiceExceptionType.REMOVED)
                        .build());
            }
            ServiceCalendar saved = serviceCalendarRepository.save(entity);
            result.put(externalId, saved);
        }
        log.info("GTFS import: {} service calendars persisted (with {} exceptions)",
                result.size(),
                result.values().stream().mapToInt(c -> c.getExceptions().size()).sum());
        return result;
    }

    private Map<String, ServiceCalendarSnapshot> loadServiceCalendars(Path workDir) throws IOException {
        Map<String, ServiceCalendarSnapshot.Builder> builders = new HashMap<>();

        Path calendar = workDir.resolve("calendar.txt");
        if (Files.exists(calendar)) {
            try (CSVParser parser = openCsv(calendar)) {
                for (CSVRecord record : parser) {
                    String serviceId = record.get("service_id");
                    Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
                    if ("1".equals(optional(record, "monday"))) { days.add(DayOfWeek.MONDAY); }
                    if ("1".equals(optional(record, "tuesday"))) { days.add(DayOfWeek.TUESDAY); }
                    if ("1".equals(optional(record, "wednesday"))) { days.add(DayOfWeek.WEDNESDAY); }
                    if ("1".equals(optional(record, "thursday"))) { days.add(DayOfWeek.THURSDAY); }
                    if ("1".equals(optional(record, "friday"))) { days.add(DayOfWeek.FRIDAY); }
                    if ("1".equals(optional(record, "saturday"))) { days.add(DayOfWeek.SATURDAY); }
                    if ("1".equals(optional(record, "sunday"))) { days.add(DayOfWeek.SUNDAY); }
                    LocalDate start = GtfsParse.parseGtfsDate(optional(record, "start_date"));
                    LocalDate end = GtfsParse.parseGtfsDate(optional(record, "end_date"));
                    builders.computeIfAbsent(serviceId, id -> new ServiceCalendarSnapshot.Builder())
                            .withWeekly(start, end, days);
                }
            }
        }

        Path calendarDates = workDir.resolve("calendar_dates.txt");
        if (Files.exists(calendarDates)) {
            try (CSVParser parser = openCsv(calendarDates)) {
                for (CSVRecord record : parser) {
                    String serviceId = record.get("service_id");
                    LocalDate date = GtfsParse.parseGtfsDate(record.get("date"));
                    if (date == null) { continue; }
                    int exceptionType = parseInt(record.get("exception_type"), 0);
                    ServiceCalendarSnapshot.Builder b =
                            builders.computeIfAbsent(serviceId, id -> new ServiceCalendarSnapshot.Builder());
                    if (exceptionType == 1) { b.added(date); }
                    else if (exceptionType == 2) { b.removed(date); }
                }
            }
        }

        Map<String, ServiceCalendarSnapshot> result = new HashMap<>();
        for (Map.Entry<String, ServiceCalendarSnapshot.Builder> e : builders.entrySet()) {
            result.put(e.getKey(), e.getValue().build());
        }
        return result;
    }

    /**
     * Reads {@code stop_times.txt} once and returns the earliest wall-clock time per trip,
     * restricted to {@code targetTrips}. Used as the fan-out anchor for frequency-mode trips.
     */
    private Map<String, LocalTime> loadTripStartTimes(Path stopTimesFile, Set<String> targetTrips)
            throws IOException {
        Map<String, LocalTime> result = new HashMap<>();
        if (targetTrips.isEmpty() || !Files.exists(stopTimesFile)) {
            return result;
        }
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                if (!targetTrips.contains(tripId)) { continue; }
                LocalTime time = GtfsParse.parseGtfsTime(firstNonBlank(
                        optional(record, "departure_time"),
                        optional(record, "arrival_time")));
                if (time == null) { continue; }
                LocalTime current = result.get(tripId);
                if (current == null || time.isBefore(current)) {
                    result.put(tripId, time);
                }
            }
        }
        return result;
    }

    private static String firstNonBlank(String a, String b) {
        return !isBlank(a) ? a : b;
    }

    // ---------- active-service helpers ----------

    /**
     * Pick the set of service IDs running on the most representative day available.
     * Prefers today, falls back to scanning ±30 days, then to the busiest day in the
     * combined feed range. Returns empty when no services are defined at all.
     */
    private Set<String> pickActiveServices(Map<String, ServiceCalendarSnapshot> services) {
        if (services.isEmpty()) { return Set.of(); }

        LocalDate today = LocalDate.now();
        for (int offset = 0; offset <= 30; offset++) {
            for (int sign : new int[]{1, -1}) {
                if (offset == 0 && sign == -1) { continue; }
                LocalDate candidate = today.plusDays(offset * (long) sign);
                Set<String> active = activeOn(services, candidate);
                if (!active.isEmpty()) {
                    log.info("GTFS import: schedule reference date is {} ({} active services)",
                            candidate, active.size());
                    return active;
                }
            }
        }

        LocalDate scanStart = services.values().stream()
                .map(ServiceCalendarSnapshot::startDate)
                .filter(d -> d != null)
                .min(LocalDate::compareTo)
                .orElse(today);
        LocalDate scanEnd = services.values().stream()
                .map(ServiceCalendarSnapshot::endDate)
                .filter(d -> d != null)
                .max(LocalDate::compareTo)
                .orElse(today);

        Set<String> best = Set.of();
        LocalDate bestDate = null;
        for (LocalDate d = scanStart;
                !d.isAfter(scanEnd) && d.isBefore(scanStart.plusDays(365));
                d = d.plusDays(1)) {
            Set<String> active = activeOn(services, d);
            if (active.size() > best.size()) {
                best = active;
                bestDate = d;
            }
        }
        if (!best.isEmpty()) {
            log.info("GTFS import: schedule reference date is {} ({} active services, fallback scan)",
                    bestDate, best.size());
        }
        return best;
    }

    private Set<String> activeOn(Map<String, ServiceCalendarSnapshot> services, LocalDate date) {
        Set<String> active = new HashSet<>();
        for (Map.Entry<String, ServiceCalendarSnapshot> e : services.entrySet()) {
            if (e.getValue().isActiveOn(date)) { active.add(e.getKey()); }
        }
        return active;
    }

    private void logReferenceDate(Map<String, ServiceCalendarSnapshot> snapshots) {
        Set<String> active = pickActiveServices(snapshots);
        if (active.isEmpty()) {
            log.info("GTFS import: no service is active anywhere in the next 30 days; feed may be stale");
        }
    }
}
