package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Collection;
import java.util.EnumSet;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipFile;

/**
 * Imports a standard GTFS feed into the application's domain model.
 * Network-agnostic: works with any GTFS-compliant feed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GtfsImportService {

    private static final int LINE_CODE_MAX_LENGTH = 10;
    private static final int LINE_NAME_MAX_LENGTH = 100;
    private static final int LINE_CATEGORY_MAX_LENGTH = 50;
    private static final int STOP_NAME_MAX_LENGTH = 100;
    private static final String DEFAULT_COLOR = "#888888";
    private static final double SCHEMATIC_SIZE = 1000.0;
    private static final double SCHEMATIC_MARGIN = 50.0;

    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ItineraryRepository itineraryRepository;
    private final ScheduleRepository scheduleRepository;

    public record ImportResult(int lines, int stops, int itineraries, int itineraryStops, int schedules) {}

    @Transactional
    public ImportResult importFromZip(Path zipPath) throws IOException {
        Path workDir = Files.createTempDirectory("gtfs-extract-");
        try {
            extractZip(zipPath, workDir);

            Map<String, Line> linesByGtfsId = importRoutes(workDir.resolve("routes.txt"));
            StopImport stopImport = importStops(workDir.resolve("stops.txt"));

            ItineraryImport itineraryImport = importItineraries(
                    workDir.resolve("trips.txt"),
                    workDir.resolve("stop_times.txt"),
                    linesByGtfsId,
                    stopImport);

            int schedules = importSchedules(workDir, itineraryImport, stopImport);

            assignSchematicCoordinates(stopImport.stopsByGtfsId.values());

            return new ImportResult(
                    linesByGtfsId.size(),
                    stopImport.stopsByGtfsId.size(),
                    itineraryImport.itineraryCount,
                    itineraryImport.itineraryStopCount,
                    schedules);
        } finally {
            deleteRecursively(workDir);
        }
    }

    private void extractZip(Path zipPath, Path target) throws IOException {
        try (ZipFile zip = new ZipFile(zipPath.toFile())) {
            zip.entries().asIterator().forEachRemaining(entry -> {
                if (entry.isDirectory()) {
                    return;
                }
                Path out = target.resolve(entry.getName()).normalize();
                if (!out.startsWith(target)) {
                    throw new IllegalStateException("Zip entry outside target: " + entry.getName());
                }
                try (InputStream in = zip.getInputStream(entry)) {
                    Files.createDirectories(out.getParent());
                    Files.copy(in, out, StandardCopyOption.REPLACE_EXISTING);
                } catch (IOException e) {
                    throw new IllegalStateException("Failed to extract " + entry.getName(), e);
                }
            });
        }
    }

    private Map<String, Line> importRoutes(Path routesFile) throws IOException {
        Map<String, Line> result = new LinkedHashMap<>();
        try (CSVParser parser = openCsv(routesFile)) {
            for (CSVRecord record : parser) {
                String routeId = record.get("route_id");
                String shortName = optional(record, "route_short_name");
                String longName = optional(record, "route_long_name");
                String color = optional(record, "route_color");
                int routeType = parseInt(record.get("route_type"), 3);
                String networkId = optional(record, "network_id");

                String code = truncate(firstNonBlank(shortName, longName, routeId), LINE_CODE_MAX_LENGTH);
                String name = truncate(firstNonBlank(longName, shortName, routeId), LINE_NAME_MAX_LENGTH);
                LineType type = GtfsParse.mapRouteType(routeType);
                String category = truncate(deriveCategory(networkId, routeType), LINE_CATEGORY_MAX_LENGTH);

                Line line = lineRepository.save(Line.builder()
                        .code(uniqueCode(code, result.values()))
                        .name(name)
                        .color(formatColor(color))
                        .type(type)
                        .category(category)
                        .build());
                result.put(routeId, line);
            }
        }
        // Collapse to route-type labels when network_id is absent or degenerate (single bucket)
        long distinctCategories = result.values().stream().map(Line::getCategory).distinct().count();
        if (distinctCategories <= 1) {
            for (Line line : result.values()) {
                line.setCategory(routeTypeLabel(line.getType()));
                lineRepository.save(line);
            }
        }
        splitOversizedBusCategories(result.values());
        log.info("GTFS import: {} lines created across {} categories",
                result.size(),
                result.values().stream().map(Line::getCategory).distinct().count());
        return result;
    }

    /**
     * When a single category lumps 30+ bus lines together (e.g. Bordeaux),
     * the line filter and category tab become unwieldy. Group them by the
     * alphabetic prefix of their short code: significant prefixes (≥ 3 lines)
     * become "{category} {prefix}" sub-categories; numeric-only and small
     * prefix groups keep the original category.
     */
    private void splitOversizedBusCategories(Collection<Line> lines) {
        Map<String, List<Line>> byCategory = new LinkedHashMap<>();
        for (Line line : lines) {
            byCategory.computeIfAbsent(line.getCategory(), c -> new ArrayList<>()).add(line);
        }
        for (Map.Entry<String, List<Line>> entry : byCategory.entrySet()) {
            applyPrefixSplit(entry.getKey(), entry.getValue());
        }
    }

    private void applyPrefixSplit(String category, List<Line> linesInCategory) {
        if (linesInCategory.size() < 30) {return;}
        for (Line line : linesInCategory) {
            if (line.getType() != LineType.BUS) {return;}
        }

        Map<String, List<Line>> byPrefix = new LinkedHashMap<>();
        for (Line line : linesInCategory) {
            byPrefix.computeIfAbsent(GtfsParse.extractAlphaPrefix(line.getCode()), p -> new ArrayList<>()).add(line);
        }

        Set<String> significant = new HashSet<>();
        for (Map.Entry<String, List<Line>> entry : byPrefix.entrySet()) {
            if (!entry.getKey().isEmpty() && entry.getValue().size() >= 3) {
                significant.add(entry.getKey());
            }
        }
        if (significant.isEmpty()) {return;}

        List<Line> dirty = new ArrayList<>();
        for (Map.Entry<String, List<Line>> entry : byPrefix.entrySet()) {
            if (!significant.contains(entry.getKey())) {continue;}
            String sub = truncate(category + " " + entry.getKey(), LINE_CATEGORY_MAX_LENGTH);
            for (Line line : entry.getValue()) {
                line.setCategory(sub);
                dirty.add(line);
            }
        }
        if (!dirty.isEmpty()) {
            lineRepository.saveAll(dirty);
            log.info("GTFS import: split '{}' ({} lines) into sub-categories by prefix", category, linesInCategory.size());
        }
    }


    private record StopImport(
            Map<String, Stop> stopsByGtfsId,
            Map<String, String> rootStopIdByGtfsId) {}

    private StopImport importStops(Path stopsFile) throws IOException {
        record RawStop(String id, String name, Double lat, Double lon, String parent, int locationType) {}

        List<RawStop> raw = new ArrayList<>();
        try (CSVParser parser = openCsv(stopsFile)) {
            for (CSVRecord record : parser) {
                int locationType = parseInt(optional(record, "location_type"), 0);
                // Skip entrances/exits (2), generic nodes (3), boarding areas (4)
                if (locationType >= 2) {
                    continue;
                }
                raw.add(new RawStop(
                        record.get("stop_id"),
                        optional(record, "stop_name"),
                        parseDoubleOrNull(optional(record, "stop_lat")),
                        parseDoubleOrNull(optional(record, "stop_lon")),
                        optional(record, "parent_station"),
                        locationType));
            }
        }

        // Resolve each stop to its root (a stop with no parent_station).
        // This generic rule handles both standard and non-standard feeds:
        //   - standard: keep location_type=1 (station) when present
        //   - non-standard: keep stops without parent_station regardless of location_type
        Map<String, RawStop> byId = new HashMap<>();
        for (RawStop r : raw) {
            byId.put(r.id, r);
        }

        Map<String, String> rootByGtfsId = new HashMap<>();
        for (RawStop r : raw) {
            String current = r.id;
            int hops = 0;
            while (true) {
                RawStop currentStop = byId.get(current);
                if (currentStop == null || isBlank(currentStop.parent) || hops > 5) {
                    break;
                }
                current = currentStop.parent;
                hops++;
            }
            rootByGtfsId.put(r.id, current);
        }

        // Persist only root stops with a name and coordinates
        Map<String, Stop> result = new LinkedHashMap<>();
        Set<String> rootIds = new HashSet<>(rootByGtfsId.values());
        for (String rootId : rootIds) {
            RawStop r = byId.get(rootId);
            if (r == null || isBlank(r.name)) {
                continue;
            }
            Stop stop = Stop.builder()
                    .name(truncate(r.name, STOP_NAME_MAX_LENGTH))
                    .latitude(r.lat)
                    .longitude(r.lon)
                    .build();
            result.put(rootId, stopRepository.save(stop));
        }
        log.info("GTFS import: {} stops created (from {} raw entries)", result.size(), raw.size());
        return new StopImport(result, rootByGtfsId);
    }

    private record ItineraryImport(
            int itineraryCount,
            int itineraryStopCount,
            Map<String, TripInfo> tripInfos,
            Map<RouteDirKey, Itinerary> itinerariesByRouteDir) {}

    private record TripInfo(String routeId, String directionId, String serviceId, String headsign) {}

    private record RouteDirKey(String routeId, String directionId) {}

    private ItineraryImport importItineraries(
            Path tripsFile,
            Path stopTimesFile,
            Map<String, Line> linesByGtfsId,
            StopImport stopImport) throws IOException {

        // 1. Read trips into memory
        Map<String, TripInfo> tripInfos = new HashMap<>();
        try (CSVParser parser = openCsv(tripsFile)) {
            for (CSVRecord record : parser) {
                tripInfos.put(record.get("trip_id"), new TripInfo(
                        record.get("route_id"),
                        firstNonBlank(optional(record, "direction_id"), "0"),
                        optional(record, "service_id"),
                        optional(record, "trip_headsign")));
            }
        }
        log.info("GTFS import: {} trips loaded", tripInfos.size());

        // 2. Pass 1 over stop_times: count stops per trip
        Map<String, Integer> stopsPerTrip = new HashMap<>();
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                stopsPerTrip.merge(tripId, 1, Integer::sum);
            }
        }

        // 3. Select representative trip per (route_id, direction_id): the one with the most stops
        Map<RouteDirKey, String> bestTrip = new HashMap<>();
        Map<RouteDirKey, Integer> bestCount = new HashMap<>();
        for (Map.Entry<String, TripInfo> entry : tripInfos.entrySet()) {
            String tripId = entry.getKey();
            TripInfo info = entry.getValue();
            if (!linesByGtfsId.containsKey(info.routeId)) {
                continue;
            }
            int count = stopsPerTrip.getOrDefault(tripId, 0);
            if (count == 0) {
                continue;
            }
            RouteDirKey key = new RouteDirKey(info.routeId, info.directionId);
            if (count > bestCount.getOrDefault(key, 0)) {
                bestCount.put(key, count);
                bestTrip.put(key, tripId);
            }
        }
        Set<String> selectedTripIds = new HashSet<>(bestTrip.values());
        log.info("GTFS import: {} representative trips selected", selectedTripIds.size());

        // 4. Pass 2 over stop_times: collect (tripId -> ordered list of stop_ids)
        record TimedStop(String stopId, int sequence) {}
        Map<String, List<TimedStop>> stopsByTrip = new HashMap<>();
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                if (!selectedTripIds.contains(tripId)) {
                    continue;
                }
                int sequence = parseInt(record.get("stop_sequence"), 0);
                String stopId = record.get("stop_id");
                stopsByTrip.computeIfAbsent(tripId, k -> new ArrayList<>())
                        .add(new TimedStop(stopId, sequence));
            }
        }

        // 5. Build itineraries
        int itineraryCount = 0;
        int itineraryStopCount = 0;
        Set<Stop> stopsTouched = new HashSet<>();
        Map<RouteDirKey, Itinerary> itinerariesByRouteDir = new HashMap<>();

        for (Map.Entry<RouteDirKey, String> entry : bestTrip.entrySet()) {
            RouteDirKey key = entry.getKey();
            String tripId = entry.getValue();
            Line line = linesByGtfsId.get(key.routeId);
            TripInfo info = tripInfos.get(tripId);
            List<TimedStop> trip = stopsByTrip.get(tripId);
            if (trip == null || trip.isEmpty()) {
                continue;
            }
            trip.sort((a, b) -> Integer.compare(a.sequence, b.sequence));

            String itineraryName = buildItineraryName(line.getCode(), info.headsign, key.directionId);
            Itinerary itinerary = Itinerary.builder()
                    .line(line)
                    .name(truncate(itineraryName, LINE_NAME_MAX_LENGTH))
                    .itineraryStops(new ArrayList<>())
                    .build();
            itinerary = itineraryRepository.save(itinerary);

            int position = 0;
            Set<Stop> seenInItinerary = new HashSet<>();
            for (TimedStop ts : trip) {
                String rootStopId = stopImport.rootStopIdByGtfsId.get(ts.stopId);
                if (rootStopId == null) {
                    continue;
                }
                Stop stop = stopImport.stopsByGtfsId.get(rootStopId);
                if (stop == null) {
                    continue;
                }
                // Dedupe within itinerary (uk_itinerary_stop)
                if (!seenInItinerary.add(stop)) {
                    continue;
                }
                ItineraryStop is = ItineraryStop.builder()
                        .itinerary(itinerary)
                        .stop(stop)
                        .position(position++)
                        .build();
                itinerary.getItineraryStops().add(is);
                stop.getLines().add(line);
                stopsTouched.add(stop);
                itineraryStopCount++;
            }
            itineraryRepository.save(itinerary);
            itinerariesByRouteDir.put(key, itinerary);
            itineraryCount++;
        }

        // Persist stop ↔ line associations
        stopRepository.saveAll(stopsTouched);

        log.info("GTFS import: {} itineraries / {} itinerary stops created", itineraryCount, itineraryStopCount);
        return new ItineraryImport(itineraryCount, itineraryStopCount, tripInfos, itinerariesByRouteDir);
    }

    private record ServiceCalendar(
            LocalDate startDate,
            LocalDate endDate,
            EnumSet<DayOfWeek> daysOfWeek,
            Set<LocalDate> addedDates,
            Set<LocalDate> removedDates) {
        boolean isActiveOn(LocalDate date) {
            if (removedDates.contains(date)) {return false;}
            if (addedDates.contains(date)) {return true;}
            if (startDate == null || endDate == null || daysOfWeek.isEmpty()) {return false;}
            if (date.isBefore(startDate) || date.isAfter(endDate)) {return false;}
            return daysOfWeek.contains(date.getDayOfWeek());
        }
    }

    private static final class ServiceCalendarBuilder {
        private LocalDate startDate;
        private LocalDate endDate;
        private EnumSet<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        private final Set<LocalDate> added = new HashSet<>();
        private final Set<LocalDate> removed = new HashSet<>();

        void withWeekly(LocalDate start, LocalDate end, EnumSet<DayOfWeek> daysOfWeek) {
            this.startDate = start;
            this.endDate = end;
            this.days = daysOfWeek;
        }

        void added(LocalDate date) {added.add(date);}
        void removed(LocalDate date) {removed.add(date);}

        ServiceCalendar build() {
            return new ServiceCalendar(startDate, endDate, days, added, removed);
        }
    }

    private static final int MAX_SCHEDULE_BATCH = 5_000;

    private int importSchedules(Path workDir, ItineraryImport itineraryImport, StopImport stopImport)
            throws IOException {
        Path stopTimesFile = workDir.resolve("stop_times.txt");
        if (!Files.exists(stopTimesFile)) {
            log.warn("GTFS import: stop_times.txt missing, skipping schedule import");
            return 0;
        }

        Map<String, ServiceCalendar> services = loadServiceCalendars(workDir);
        Set<String> activeServices = pickActiveServices(services);
        if (activeServices.isEmpty()) {
            log.warn("GTFS import: no active services found in calendar files, skipping schedule import");
            return 0;
        }

        Map<String, TripInfo> tripInfos = itineraryImport.tripInfos;
        Map<RouteDirKey, Itinerary> itineraries = itineraryImport.itinerariesByRouteDir;

        // (stopId, itineraryId, time) dedupe key — matches uk_schedule_stop_itinerary_time
        record ScheduleKey(java.util.UUID stopId, java.util.UUID itineraryId, LocalTime time) {}
        Set<ScheduleKey> seen = new HashSet<>();
        List<Schedule> batch = new ArrayList<>(MAX_SCHEDULE_BATCH);
        int total = 0;

        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                TripInfo trip = tripInfos.get(tripId);
                if (trip == null || !activeServices.contains(trip.serviceId)) {continue;}

                Itinerary itinerary = itineraries.get(new RouteDirKey(trip.routeId, trip.directionId));
                if (itinerary == null) {continue;}

                String rootStopId = stopImport.rootStopIdByGtfsId.get(record.get("stop_id"));
                if (rootStopId == null) {continue;}
                Stop stop = stopImport.stopsByGtfsId.get(rootStopId);
                if (stop == null) {continue;}

                LocalTime time = GtfsParse.parseGtfsTime(firstNonBlank(
                        optional(record, "departure_time"),
                        optional(record, "arrival_time")));
                if (time == null) {continue;}

                ScheduleKey key = new ScheduleKey(stop.getId(), itinerary.getId(), time);
                if (!seen.add(key)) {continue;}

                batch.add(Schedule.builder()
                        .time(time)
                        .stop(stop)
                        .itinerary(itinerary)
                        .build());

                if (batch.size() >= MAX_SCHEDULE_BATCH) {
                    scheduleRepository.saveAll(batch);
                    total += batch.size();
                    batch.clear();
                    if (log.isDebugEnabled()) {
                        log.debug("GTFS import: {} schedules persisted so far", total);
                    }
                }
            }
        }

        if (!batch.isEmpty()) {
            scheduleRepository.saveAll(batch);
            total += batch.size();
        }

        log.info("GTFS import: {} schedules created across {} active services", total, activeServices.size());
        return total;
    }

    private Map<String, ServiceCalendar> loadServiceCalendars(Path workDir) throws IOException {
        Map<String, ServiceCalendarBuilder> builders = new HashMap<>();

        Path calendar = workDir.resolve("calendar.txt");
        if (Files.exists(calendar)) {
            try (CSVParser parser = openCsv(calendar)) {
                for (CSVRecord record : parser) {
                    String serviceId = record.get("service_id");
                    EnumSet<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
                    if ("1".equals(optional(record, "monday"))) {days.add(DayOfWeek.MONDAY);}
                    if ("1".equals(optional(record, "tuesday"))) {days.add(DayOfWeek.TUESDAY);}
                    if ("1".equals(optional(record, "wednesday"))) {days.add(DayOfWeek.WEDNESDAY);}
                    if ("1".equals(optional(record, "thursday"))) {days.add(DayOfWeek.THURSDAY);}
                    if ("1".equals(optional(record, "friday"))) {days.add(DayOfWeek.FRIDAY);}
                    if ("1".equals(optional(record, "saturday"))) {days.add(DayOfWeek.SATURDAY);}
                    if ("1".equals(optional(record, "sunday"))) {days.add(DayOfWeek.SUNDAY);}
                    LocalDate start = GtfsParse.parseGtfsDate(optional(record, "start_date"));
                    LocalDate end = GtfsParse.parseGtfsDate(optional(record, "end_date"));
                    builders.computeIfAbsent(serviceId, id -> new ServiceCalendarBuilder())
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
                    if (date == null) {continue;}
                    int exceptionType = parseInt(record.get("exception_type"), 0);
                    ServiceCalendarBuilder b = builders.computeIfAbsent(serviceId, id -> new ServiceCalendarBuilder());
                    if (exceptionType == 1) {b.added(date);}
                    else if (exceptionType == 2) {b.removed(date);}
                }
            }
        }

        Map<String, ServiceCalendar> result = new HashMap<>();
        for (Map.Entry<String, ServiceCalendarBuilder> e : builders.entrySet()) {
            result.put(e.getKey(), e.getValue().build());
        }
        return result;
    }

    /**
     * Pick the set of service IDs running on the most representative day available.
     * Prefers today, falls back to scanning ±30 days, then to the busiest day in the
     * combined feed range. Returns empty when no services are defined at all.
     */
    private Set<String> pickActiveServices(Map<String, ServiceCalendar> services) {
        if (services.isEmpty()) {return Set.of();}

        LocalDate today = LocalDate.now();
        for (int offset = 0; offset <= 30; offset++) {
            for (int sign : new int[]{1, -1}) {
                if (offset == 0 && sign == -1) {continue;}
                LocalDate candidate = today.plusDays(offset * (long) sign);
                Set<String> active = activeOn(services, candidate);
                if (!active.isEmpty()) {
                    log.info("GTFS import: schedule reference date is {} ({} active services)",
                            candidate, active.size());
                    return active;
                }
            }
        }

        // Last-resort: pick the date with the most active services across the union of
        // all calendar ranges. Bounded to 365 candidates to keep the search cheap.
        LocalDate scanStart = services.values().stream()
                .map(ServiceCalendar::startDate)
                .filter(d -> d != null)
                .min(LocalDate::compareTo)
                .orElse(today);
        LocalDate scanEnd = services.values().stream()
                .map(ServiceCalendar::endDate)
                .filter(d -> d != null)
                .max(LocalDate::compareTo)
                .orElse(today);

        Set<String> best = Set.of();
        LocalDate bestDate = null;
        for (LocalDate d = scanStart; !d.isAfter(scanEnd) && d.isBefore(scanStart.plusDays(365)); d = d.plusDays(1)) {
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

    private Set<String> activeOn(Map<String, ServiceCalendar> services, LocalDate date) {
        Set<String> active = new HashSet<>();
        for (Map.Entry<String, ServiceCalendar> e : services.entrySet()) {
            if (e.getValue().isActiveOn(date)) {active.add(e.getKey());}
        }
        return active;
    }

    private void assignSchematicCoordinates(Collection<Stop> stops) {
        double minLat = Double.POSITIVE_INFINITY;
        double maxLat = Double.NEGATIVE_INFINITY;
        double minLon = Double.POSITIVE_INFINITY;
        double maxLon = Double.NEGATIVE_INFINITY;
        int withGeo = 0;
        for (Stop s : stops) {
            if (s.getLatitude() == null || s.getLongitude() == null) {
                continue;
            }
            withGeo++;
            minLat = Math.min(minLat, s.getLatitude());
            maxLat = Math.max(maxLat, s.getLatitude());
            minLon = Math.min(minLon, s.getLongitude());
            maxLon = Math.max(maxLon, s.getLongitude());
        }
        log.info("GTFS import: schematic bbox over {} stops: lat=[{}, {}] lon=[{}, {}]",
                withGeo, minLat, maxLat, minLon, maxLon);
        if (Double.isInfinite(minLat) || maxLat == minLat || maxLon == minLon) {
            log.warn("GTFS import: cannot compute schematic coordinates (degenerate bbox)");
            return;
        }
        double latRange = maxLat - minLat;
        double lonRange = maxLon - minLon;
        double usable = SCHEMATIC_SIZE - 2 * SCHEMATIC_MARGIN;
        List<Stop> dirty = new ArrayList<>(stops.size());
        for (Stop s : stops) {
            if (s.getLatitude() == null || s.getLongitude() == null) {
                continue;
            }
            double x = SCHEMATIC_MARGIN + ((s.getLongitude() - minLon) / lonRange) * usable;
            // Y inverted: north (high lat) is at top (low y)
            double y = SCHEMATIC_MARGIN + ((maxLat - s.getLatitude()) / latRange) * usable;
            s.setSchematicX(x);
            s.setSchematicY(y);
            dirty.add(s);
        }
        stopRepository.saveAll(dirty);
        log.info("GTFS import: schematic coordinates assigned to {} stops", dirty.size());
    }

    // ---------- helpers ----------

    private CSVParser openCsv(Path file) throws IOException {
        return CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreSurroundingSpaces(true)
                .setIgnoreEmptyLines(true)
                .build()
                .parse(Files.newBufferedReader(file, StandardCharsets.UTF_8));
    }

    private static String deriveCategory(String networkId, int routeType) {
        if (!isBlank(networkId)) {
            return networkId.trim();
        }
        return routeTypeLabel(GtfsParse.mapRouteType(routeType));
    }

    private static String routeTypeLabel(LineType type) {
        if (type == null) {
            return "Bus";
        }
        return switch (type) {
            case TRAM -> "Tram";
            case METRO -> "Metro";
            case TRAIN -> "Train";
            case BUS -> "Bus";
            case FERRY -> "Ferry";
            case FUNICULAR -> "Funicular";
            case CABLE_CAR -> "Cable car";
            case TROLLEYBUS -> "Trolleybus";
            case MONORAIL -> "Monorail";
            case OTHER -> "Other";
        };
    }

    private static String formatColor(String raw) {
        if (isBlank(raw)) {
            return DEFAULT_COLOR;
        }
        String trimmed = raw.trim();
        String hex = trimmed.startsWith("#") ? trimmed : "#" + trimmed;
        return hex.matches("^#[0-9A-Fa-f]{6}$") ? hex : DEFAULT_COLOR;
    }

    private static String buildItineraryName(String lineCode, String headsign, String directionId) {
        if (!isBlank(headsign)) {
            return "→ " + headsign.trim();
        }
        return "Direction " + ("0".equals(directionId) ? "0" : "1");
    }

    private static String uniqueCode(String preferred, Collection<Line> existing) {
        Set<String> taken = new HashSet<>();
        for (Line l : existing) {
            taken.add(l.getCode());
        }
        if (!taken.contains(preferred)) {
            return preferred;
        }
        for (int i = 2; i < 10000; i++) {
            String candidate = truncate(preferred, LINE_CODE_MAX_LENGTH - String.valueOf(i).length() - 1)
                    + "-" + i;
            if (!taken.contains(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Cannot generate unique line code for " + preferred);
    }

    private static String optional(CSVRecord record, String column) {
        return record.isMapped(column) ? record.get(column) : "";
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (!isBlank(v)) {
                return v.trim();
            }
        }
        return "";
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static int parseInt(String s, int defaultValue) {
        if (isBlank(s)) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static Double parseDoubleOrNull(String s) {
        if (isBlank(s)) {
            return null;
        }
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static void deleteRecursively(Path path) {
        if (path == null || !Files.exists(path)) {
            return;
        }
        try (var stream = Files.walk(path)) {
            stream.sorted((a, b) -> b.getNameCount() - a.getNameCount())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                            // best-effort cleanup
                        }
                    });
        } catch (IOException ignored) {
            // best-effort cleanup
        }
    }
}
