package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.Attribution;
import com.transit.hub.domain.model.FeedInfo;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.ServiceCalendarException;
import com.transit.hub.domain.model.StationLevel;
import com.transit.hub.domain.model.Translation;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.Transfer;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.PathwayMode;
import com.transit.hub.domain.model.enums.ServiceExceptionType;
import com.transit.hub.domain.util.ColorContrast;
import com.transit.hub.infrastructure.persistence.AgencyRepository;
import com.transit.hub.infrastructure.persistence.AttributionRepository;
import com.transit.hub.infrastructure.persistence.FeedInfoRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TransferRepository;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
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

    private static final int LINE_CODE_MAX_LENGTH = 30;
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
    private final FeedInfoRepository feedInfoRepository;
    private final AgencyRepository agencyRepository;
    private final TransferRepository transferRepository;
    private final AttributionRepository attributionRepository;
    private final ServiceCalendarRepository serviceCalendarRepository;
    private final StationLevelRepository stationLevelRepository;
    private final PathwayRepository pathwayRepository;
    private final TranslationRepository translationRepository;

    public record ImportResult(int lines, int stops, int itineraries, int itineraryStops, int schedules) {}

    @Transactional
    public ImportResult importFromZip(Path zipPath) throws IOException {
        return importFromZip(zipPath, null, null);
    }

    /**
     * Import a GTFS feed from a local zip, recording the {@code sourceUrl}
     * and {@code sourceHash} on the singleton {@link FeedInfo} row so the
     * admin dashboard can surface where the data came from and detect
     * unchanged re-downloads.
     */
    @Transactional
    public ImportResult importFromZip(Path zipPath, String sourceUrl, String sourceHash) throws IOException {
        Path workDir = Files.createTempDirectory("gtfs-extract-");
        try {
            extractZip(zipPath, workDir);

            persistFeedInfo(workDir.resolve("feed_info.txt"), sourceUrl, sourceHash);

            Map<String, Agency> agenciesByGtfsId = importAgencies(workDir.resolve("agency.txt"));
            Map<String, Line> linesByGtfsId = importRoutes(workDir.resolve("routes.txt"), agenciesByGtfsId);
            StopImport stopImport = importStops(workDir.resolve("stops.txt"));

            ItineraryImport itineraryImport = importItineraries(
                    workDir.resolve("trips.txt"),
                    workDir.resolve("stop_times.txt"),
                    linesByGtfsId,
                    stopImport);

            Map<String, FrequencyInfo> frequencies = loadFrequencies(workDir.resolve("frequencies.txt"));

            int schedules = importSchedules(workDir, itineraryImport, stopImport, frequencies);

            importTransfers(workDir.resolve("transfers.txt"), stopImport);

            importStationLevels(workDir.resolve("levels.txt"));

            importPathways(workDir.resolve("pathways.txt"), stopImport);

            importTranslations(workDir.resolve("translations.txt"));

            importAttributions(workDir.resolve("attributions.txt"));

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

    /**
     * Reads {@code feed_info.txt} when present (the file is GTFS-optional)
     * and replaces the singleton {@link FeedInfo} row. When the file is
     * missing we still write a row so admins can see at least the source
     * URL and import timestamp.
     */
    private void persistFeedInfo(Path feedInfoFile, String sourceUrl, String sourceHash) throws IOException {
        FeedInfo.FeedInfoBuilder builder = FeedInfo.builder()
                .sourceUrl(sourceUrl)
                .sourceHash(sourceHash)
                .importedAt(java.time.Instant.now());

        if (Files.exists(feedInfoFile)) {
            try (CSVParser parser = openCsv(feedInfoFile)) {
                for (CSVRecord record : parser) {
                    builder
                            .publisherName(truncate(optional(record, "feed_publisher_name"), 200))
                            .publisherUrl(truncate(optional(record, "feed_publisher_url"), 500))
                            .lang(truncate(optional(record, "feed_lang"), 20))
                            .defaultLang(truncate(optional(record, "default_lang"), 20))
                            .feedVersion(truncate(optional(record, "feed_version"), 50))
                            .contactEmail(truncate(optional(record, "feed_contact_email"), 50))
                            .contactUrl(truncate(optional(record, "feed_contact_url"), 500))
                            .startDate(GtfsParse.parseGtfsDate(optional(record, "feed_start_date")))
                            .endDate(GtfsParse.parseGtfsDate(optional(record, "feed_end_date")));
                    break; // GTFS spec allows only one record in feed_info.txt
                }
            }
        } else {
            log.info("GTFS import: feed_info.txt missing, recording import metadata only");
        }

        // Replace any prior singleton — we never accumulate history here
        // (use import_audit for that, added in 0.8). deleteAllInBatch is a
        // no-op when the table is empty, so the first-import path stays cheap.
        feedInfoRepository.deleteAllInBatch();
        feedInfoRepository.flush();
        feedInfoRepository.save(builder.build());
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

    /**
     * Reads {@code agency.txt} when present. The file is GTFS-required when
     * the feed declares more than one agency but technically optional in
     * single-agency feeds. We always make sure at least one row exists so
     * the timezone resolution path can rely on a non-null reference.
     */
    private Map<String, Agency> importAgencies(Path agenciesFile) throws IOException {
        Map<String, Agency> result = new LinkedHashMap<>();
        if (!Files.exists(agenciesFile)) {
            log.info("GTFS import: agency.txt missing, no agencies persisted");
            return result;
        }
        try (CSVParser parser = openCsv(agenciesFile)) {
            for (CSVRecord record : parser) {
                String agencyId = optional(record, "agency_id");
                String name = truncate(optional(record, "agency_name"), 200);
                if (isBlank(name)) {
                    // GTFS allows agency_name to be empty when there is exactly
                    // one agency, but we need *something* to render in the UI.
                    name = "Unnamed agency";
                }

                Agency agency = Agency.builder()
                        .externalId(isBlank(agencyId) ? null : truncate(agencyId.trim(), 100))
                        .name(name)
                        .url(truncate(optional(record, "agency_url"), 500))
                        .timezone(truncate(optional(record, "agency_timezone"), 60))
                        .lang(truncate(optional(record, "agency_lang"), 10))
                        .phone(truncate(optional(record, "agency_phone"), 30))
                        .fareUrl(truncate(optional(record, "agency_fare_url"), 500))
                        .email(truncate(optional(record, "agency_email"), 100))
                        .build();
                Agency saved = agencyRepository.save(agency);
                // Index both by the GTFS agency_id (when present) and by the
                // empty string so single-agency feeds can resolve to it.
                result.put(isBlank(agencyId) ? "" : agencyId, saved);
            }
        }
        log.info("GTFS import: {} agencies created", result.size());
        return result;
    }

    private Map<String, Line> importRoutes(Path routesFile, Map<String, Agency> agencies) throws IOException {
        Map<String, Line> result = new LinkedHashMap<>();
        try (CSVParser parser = openCsv(routesFile)) {
            for (CSVRecord record : parser) {
                String routeId = record.get("route_id");
                String shortName = optional(record, "route_short_name");
                String longName = optional(record, "route_long_name");
                String color = optional(record, "route_color");
                String textColor = optional(record, "route_text_color");
                int routeType = parseInt(record.get("route_type"), 3);
                String networkId = optional(record, "network_id");
                String agencyId = optional(record, "agency_id");

                String code = truncate(firstNonBlank(shortName, longName, routeId), LINE_CODE_MAX_LENGTH);
                String name = truncate(firstNonBlank(longName, shortName, routeId), LINE_NAME_MAX_LENGTH);
                LineType type = GtfsParse.mapRouteType(routeType);
                String category = truncate(deriveCategory(networkId, routeType), LINE_CATEGORY_MAX_LENGTH);
                String formattedColor = formatColor(color);
                String formattedTextColor = resolveTextColor(textColor, formattedColor);
                Agency agency = resolveAgency(agencyId, agencies);

                short continuousPickup = (short) parseInt(optional(record, "continuous_pickup"), 1);
                short continuousDropOff = (short) parseInt(optional(record, "continuous_drop_off"), 1);
                String sortOrderRaw = optional(record, "route_sort_order");
                Integer sortOrder = isBlank(sortOrderRaw) ? null : parseIntOrNull(sortOrderRaw);
                String routeDesc = truncate(optional(record, "route_desc"), 500);
                String routeUrl = truncate(optional(record, "route_url"), 255);

                Line line = lineRepository.save(Line.builder()
                        .externalId(truncate(routeId, 100))
                        .code(uniqueCode(code, result.values()))
                        .name(name)
                        .color(formattedColor)
                        .textColor(formattedTextColor)
                        .type(type)
                        .category(category)
                        .agency(agency)
                        .continuousPickup(continuousPickup)
                        .continuousDropOff(continuousDropOff)
                        .sortOrder(sortOrder)
                        .description(isBlank(routeDesc) ? null : routeDesc)
                        .url(isBlank(routeUrl) ? null : routeUrl)
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
        record RawStop(String id, String name, Double lat, Double lon, String parent, int locationType,
                       String shortCode, String ttsName, String timezone, String description, String url,
                       int wheelchairBoarding, String platformCode) {}

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
                        locationType,
                        optional(record, "stop_code"),
                        optional(record, "tts_stop_name"),
                        optional(record, "stop_timezone"),
                        optional(record, "stop_desc"),
                        optional(record, "stop_url"),
                        parseInt(optional(record, "wheelchair_boarding"), 0),
                        optional(record, "platform_code")));
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
                    .externalId(truncate(rootId, 100))
                    .name(truncate(r.name, STOP_NAME_MAX_LENGTH))
                    .latitude(r.lat)
                    .longitude(r.lon)
                    .shortCode(truncate(r.shortCode, 50))
                    .ttsName(truncate(r.ttsName, 150))
                    .stopTimezone(truncate(r.timezone, 60))
                    .description(truncate(r.description, 500))
                    .url(truncate(r.url, 255))
                    .wheelchairBoarding(
                            com.transit.hub.domain.model.enums.WheelchairAccess.fromGtfs(r.wheelchairBoarding))
                    .platformCode(isBlank(r.platformCode) ? null : truncate(r.platformCode, 10))
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

    private record TripInfo(String routeId, String directionId, String serviceId, String headsign,
                            int wheelchairAccessible, int bikesAllowed, String blockId) {}

    /** Headway annotation derived from frequencies.txt. We pick the
     *  smallest headway among all entries declared for a trip — that's
     *  the "best case" frequency the kiosk can confidently advertise. */
    private record FrequencyInfo(int headwaySeconds, Boolean exactTimes) {}

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
                String rawBlockId = optional(record, "block_id");
                tripInfos.put(record.get("trip_id"), new TripInfo(
                        record.get("route_id"),
                        firstNonBlank(optional(record, "direction_id"), "0"),
                        optional(record, "service_id"),
                        optional(record, "trip_headsign"),
                        parseInt(optional(record, "wheelchair_accessible"), 0),
                        parseInt(optional(record, "bikes_allowed"), 0),
                        isBlank(rawBlockId) ? null : truncate(rawBlockId.trim(), 40)));
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

        // 4. Pass 2 over stop_times: collect (tripId -> ordered list of stops with their per-stop headsign)
        record TimedStop(String stopId, int sequence, String headsign) {}
        Map<String, List<TimedStop>> stopsByTrip = new HashMap<>();
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                if (!selectedTripIds.contains(tripId)) {
                    continue;
                }
                int sequence = parseInt(record.get("stop_sequence"), 0);
                String stopId = record.get("stop_id");
                String headsign = optional(record, "stop_headsign");
                stopsByTrip.computeIfAbsent(tripId, k -> new ArrayList<>())
                        .add(new TimedStop(stopId, sequence, isBlank(headsign) ? null : headsign.trim()));
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
            // Majority vote on wheelchair_accessible across every trip
            // matching this (route, direction). The representative trip
            // alone would underestimate accessibility on networks where
            // the longest variant happens to be the non-accessible one.
            com.transit.hub.domain.model.enums.WheelchairAccess wheelchairDefault =
                    majorityWheelchair(tripInfos, key);
            com.transit.hub.domain.model.enums.BikesAllowed bikesDefault =
                    majorityBikes(tripInfos, key);
            Itinerary itinerary = Itinerary.builder()
                    .externalId(truncate(tripId, 100))
                    .line(line)
                    .name(truncate(itineraryName, LINE_NAME_MAX_LENGTH))
                    .wheelchairDefault(wheelchairDefault)
                    .bikesAllowedDefault(bikesDefault)
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
                        .stopHeadsign(truncate(ts.headsign, 100))
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

    /**
     * In-memory parsing buffer. Persisted later as a {@link ServiceCalendar}
     * entity once we know which {@code service_id}s are referenced by trips.
     */
    private record ServiceCalendarSnapshot(
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

    private static final class ServiceCalendarSnapshotBuilder {
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

        ServiceCalendarSnapshot build() {
            return new ServiceCalendarSnapshot(startDate, endDate, days, added, removed);
        }
    }

    private static final int MAX_SCHEDULE_BATCH = 5_000;

    /**
     * Reads {@code frequencies.txt} into a {@code tripId -> FrequencyInfo}
     * map. Trips with multiple windows (e.g. peak vs off-peak) collapse
     * to the smallest headway — that's the most useful number for
     * "every X min" display since passenger expectation tracks the best
     * case more than the worst. Absent file = empty map.
     */
    private Map<String, FrequencyInfo> loadFrequencies(Path frequenciesFile) throws IOException {
        Map<String, FrequencyInfo> result = new HashMap<>();
        if (!Files.exists(frequenciesFile)) {
            return result;
        }
        try (CSVParser parser = openCsv(frequenciesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                int headway = parseInt(optional(record, "headway_secs"), 0);
                if (isBlank(tripId) || headway <= 0) {continue;}
                String exactRaw = optional(record, "exact_times");
                Boolean exact = isBlank(exactRaw) ? null : "1".equals(exactRaw.trim());
                FrequencyInfo current = result.get(tripId);
                if (current == null || headway < current.headwaySeconds) {
                    result.put(tripId, new FrequencyInfo(headway, exact));
                }
            }
        }
        log.info("GTFS import: {} trips carry frequency annotations", result.size());
        return result;
    }

    private int importSchedules(Path workDir, ItineraryImport itineraryImport, StopImport stopImport,
                                Map<String, FrequencyInfo> frequencies)
            throws IOException {
        Path stopTimesFile = workDir.resolve("stop_times.txt");
        if (!Files.exists(stopTimesFile)) {
            log.warn("GTFS import: stop_times.txt missing, skipping schedule import");
            return 0;
        }

        Map<String, ServiceCalendarSnapshot> snapshots = loadServiceCalendars(workDir);
        if (snapshots.isEmpty()) {
            log.warn("GTFS import: no service calendars found, skipping schedule import");
            return 0;
        }
        Map<String, ServiceCalendar> services = persistServiceCalendars(snapshots);
        // Log the "representative day" for ops-grade visibility. The value
        // no longer drives import filtering — every active service is now
        // persisted — but it stays useful when debugging "is the feed
        // current?" complaints.
        logReferenceDate(snapshots);

        Map<String, TripInfo> tripInfos = itineraryImport.tripInfos;
        Map<RouteDirKey, Itinerary> itineraries = itineraryImport.itinerariesByRouteDir;

        // (stopId, itineraryId, time, serviceCalendarId) dedupe key matches
        // uk_schedule_stop_itinerary_time_calendar; lets two services share a
        // {stop, itinerary, time} triple as long as their calendar differs.
        record ScheduleKey(java.util.UUID stopId, java.util.UUID itineraryId,
                           LocalTime time, java.util.UUID calendarId) {}
        Set<ScheduleKey> seen = new HashSet<>();
        List<Schedule> batch = new ArrayList<>(MAX_SCHEDULE_BATCH);
        int total = 0;
        int skippedNoCalendar = 0;

        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                TripInfo trip = tripInfos.get(tripId);
                if (trip == null) {continue;}
                ServiceCalendar calendar = services.get(trip.serviceId);
                if (calendar == null) {
                    // Trip references a service_id that wasn't declared in
                    // calendar.txt or calendar_dates.txt: the spec calls it
                    // a feed bug; we drop the row rather than persist a
                    // schedule we can never decide whether to display.
                    skippedNoCalendar++;
                    continue;
                }

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

                short pickupType = (short) parseInt(optional(record, "pickup_type"), 0);
                short dropOffType = (short) parseInt(optional(record, "drop_off_type"), 0);
                // (1, 1) means "no service at this stop_time" per the GTFS spec.
                // Filter so the row never shows up on a kiosk as a phantom arrival.
                if (pickupType == 1 && dropOffType == 1) {continue;}

                ScheduleKey key = new ScheduleKey(stop.getId(), itinerary.getId(), time, calendar.getId());
                if (!seen.add(key)) {continue;}

                // Wheelchair / bikes overrides: only stored when the trip's
                // value diverges from the itinerary's majority default. Saves
                // ~2 bytes × millions of rows on most feeds.
                Boolean wheelchairOverride = computeWheelchairOverride(trip.wheelchairAccessible,
                        itinerary.getWheelchairDefault());
                Boolean bikesOverride = computeBikesOverride(trip.bikesAllowed,
                        itinerary.getBikesAllowedDefault());
                // GTFS timepoint defaults to "exact" when omitted; only an
                // explicit 0 means the time is approximate.
                String timepointRaw = optional(record, "timepoint");
                boolean timepoint = isBlank(timepointRaw) || !"0".equals(timepointRaw.trim());

                FrequencyInfo freq = frequencies.get(tripId);

                batch.add(Schedule.builder()
                        .time(time)
                        .stop(stop)
                        .itinerary(itinerary)
                        .pickupType(pickupType)
                        .dropOffType(dropOffType)
                        .wheelchairOverride(wheelchairOverride)
                        .bikesAllowedOverride(bikesOverride)
                        .timepoint(timepoint)
                        .frequencyHeadwaySeconds(freq == null ? null : freq.headwaySeconds)
                        .frequencyExactTimes(freq == null ? null : freq.exactTimes)
                        .blockId(trip.blockId)
                        .serviceCalendar(calendar)
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

        if (skippedNoCalendar > 0) {
            log.warn("GTFS import: skipped {} stop_times rows whose trip references an unknown service_id",
                    skippedNoCalendar);
        }
        log.info("GTFS import: {} schedules created across {} service calendars", total, services.size());
        return total;
    }

    /**
     * Persists each {@link ServiceCalendarSnapshot} as a {@link ServiceCalendar}
     * row plus its {@link ServiceCalendarException}s. Wipes the existing
     * calendar tables first so re-imports start from a clean slate; the
     * {@code ON DELETE SET NULL} on {@code schedules.service_calendar_id}
     * keeps any stale schedule rows displayable as "always active" until
     * they get refreshed by the rest of the import.
     */
    private Map<String, ServiceCalendar> persistServiceCalendars(Map<String, ServiceCalendarSnapshot> snapshots) {
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
            // Build exceptions before save so the cascade picks them up.
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

    private void logReferenceDate(Map<String, ServiceCalendarSnapshot> snapshots) {
        Set<String> active = pickActiveServices(snapshots);
        if (active.isEmpty()) {
            log.info("GTFS import: no service is active anywhere in the next 30 days; feed may be stale");
        }
    }

    private Map<String, ServiceCalendarSnapshot> loadServiceCalendars(Path workDir) throws IOException {
        Map<String, ServiceCalendarSnapshotBuilder> builders = new HashMap<>();

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
                    builders.computeIfAbsent(serviceId, id -> new ServiceCalendarSnapshotBuilder())
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
                    ServiceCalendarSnapshotBuilder b = builders.computeIfAbsent(serviceId, id -> new ServiceCalendarSnapshotBuilder());
                    if (exceptionType == 1) {b.added(date);}
                    else if (exceptionType == 2) {b.removed(date);}
                }
            }
        }

        Map<String, ServiceCalendarSnapshot> result = new HashMap<>();
        for (Map.Entry<String, ServiceCalendarSnapshotBuilder> e : builders.entrySet()) {
            result.put(e.getKey(), e.getValue().build());
        }
        return result;
    }

    /**
     * Pick the set of service IDs running on the most representative day available.
     * Prefers today, falls back to scanning ±30 days, then to the busiest day in the
     * combined feed range. Returns empty when no services are defined at all.
     * <p>
     * Used only for ops logging now — the importer no longer filters schedules by
     * a single representative day, see {@link #importSchedules}.
     */
    private Set<String> pickActiveServices(Map<String, ServiceCalendarSnapshot> services) {
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

    private Set<String> activeOn(Map<String, ServiceCalendarSnapshot> services, LocalDate date) {
        Set<String> active = new HashSet<>();
        for (Map.Entry<String, ServiceCalendarSnapshot> e : services.entrySet()) {
            if (e.getValue().isActiveOn(date)) {active.add(e.getKey());}
        }
        return active;
    }

    /**
     * Reads {@code transfers.txt} when present (the file is GTFS-optional).
     * Resolves both endpoints through the same parent-station collapse the
     * importer does for stop_times so a transfer declared between quays
     * still maps to the persisted root stops the kiosks know about.
     */
    private void importTransfers(Path transfersFile, StopImport stopImport) throws IOException {
        if (!Files.exists(transfersFile)) {
            log.info("GTFS import: transfers.txt missing, skipping");
            return;
        }
        List<Transfer> batch = new ArrayList<>();
        int skippedUnknownStop = 0;
        try (CSVParser parser = openCsv(transfersFile)) {
            for (CSVRecord record : parser) {
                String fromGtfs = optional(record, "from_stop_id");
                String toGtfs = optional(record, "to_stop_id");
                if (isBlank(fromGtfs) || isBlank(toGtfs)) {continue;}

                Stop fromStop = resolveStop(fromGtfs, stopImport);
                Stop toStop = resolveStop(toGtfs, stopImport);
                if (fromStop == null || toStop == null) {
                    skippedUnknownStop++;
                    continue;
                }
                // self-transfer rows describe waiting at a station for a
                // different platform's service; we keep them — the route-
                // finder ignores zero-length edges anyway.

                short transferType = (short) parseInt(optional(record, "transfer_type"), 0);
                Integer minTransferTime = parseIntOrNull(optional(record, "min_transfer_time"));

                batch.add(Transfer.builder()
                        .fromStop(fromStop)
                        .toStop(toStop)
                        .transferType(transferType)
                        .minTransferTime(minTransferTime)
                        .build());
            }
        }
        if (!batch.isEmpty()) {
            transferRepository.saveAll(batch);
        }
        log.info("GTFS import: {} transfers created ({} rows skipped — unknown stop)",
                batch.size(), skippedUnknownStop);
    }

    /**
     * Reads {@code levels.txt} when present. Wipes the table first so
     * each import starts from a clean slate; pathways referencing a
     * level that has been dropped will simply find no row, which the
     * admin endpoint handles via a null check.
     */
    private void importStationLevels(Path levelsFile) throws IOException {
        stationLevelRepository.deleteAllInBatch();
        stationLevelRepository.flush();

        if (!Files.exists(levelsFile)) {
            log.info("GTFS import: levels.txt missing, skipping");
            return;
        }
        List<StationLevel> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(levelsFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "level_id");
                if (isBlank(externalId)) {continue;}
                Double levelIndex = parseDoubleOrNull(optional(record, "level_index"));
                if (levelIndex == null) {continue;}
                batch.add(StationLevel.builder()
                        .externalId(truncate(externalId, 100))
                        .levelIndex(levelIndex)
                        .levelName(truncate(optional(record, "level_name"), 100))
                        .build());
            }
        }
        if (!batch.isEmpty()) {
            stationLevelRepository.saveAll(batch);
        }
        log.info("GTFS import: {} station levels created", batch.size());
    }

    /**
     * Reads {@code pathways.txt} when present. Endpoints are resolved
     * through the same parent-station collapse the schedule importer
     * uses, so a pathway between two quays of the same station will
     * end up as a self-transfer at the root stop until Phase 1.3
     * introduces per-platform Stop rows. Self-transfer rows are still
     * worth persisting — they expose elevators / escalators that an
     * accessibility filter can later highlight.
     */
    private void importPathways(Path pathwaysFile, StopImport stopImport) throws IOException {
        pathwayRepository.deleteAllInBatch();
        pathwayRepository.flush();

        if (!Files.exists(pathwaysFile)) {
            log.info("GTFS import: pathways.txt missing, skipping");
            return;
        }
        List<Pathway> batch = new ArrayList<>();
        int skippedUnknownStop = 0;
        int skippedUnknownMode = 0;
        try (CSVParser parser = openCsv(pathwaysFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "pathway_id");
                if (isBlank(externalId)) {continue;}
                String fromGtfs = optional(record, "from_stop_id");
                String toGtfs = optional(record, "to_stop_id");
                if (isBlank(fromGtfs) || isBlank(toGtfs)) {continue;}

                Stop fromStop = resolveStop(fromGtfs, stopImport);
                Stop toStop = resolveStop(toGtfs, stopImport);
                if (fromStop == null || toStop == null) {
                    skippedUnknownStop++;
                    continue;
                }

                int modeCode = parseInt(optional(record, "pathway_mode"), 0);
                PathwayMode mode = PathwayMode.fromGtfsCode(modeCode);
                if (mode == null) {
                    skippedUnknownMode++;
                    continue;
                }
                boolean bidirectional = "1".equals(optional(record, "is_bidirectional"));

                batch.add(Pathway.builder()
                        .externalId(truncate(externalId, 100))
                        .fromStop(fromStop)
                        .toStop(toStop)
                        .pathwayMode(mode)
                        .bidirectional(bidirectional)
                        .lengthMetres(parseDoubleOrNull(optional(record, "length")))
                        .traversalTimeSeconds(parseIntOrNull(optional(record, "traversal_time")))
                        .stairCount(parseIntOrNull(optional(record, "stair_count")))
                        .maxSlope(parseDoubleOrNull(optional(record, "max_slope")))
                        .minWidthMetres(parseDoubleOrNull(optional(record, "min_width")))
                        .signpostedAs(truncate(optional(record, "signposted_as"), 200))
                        .reversedSignpostedAs(truncate(optional(record, "reversed_signposted_as"), 200))
                        .build());
            }
        }
        if (!batch.isEmpty()) {
            pathwayRepository.saveAll(batch);
        }
        log.info("GTFS import: {} pathways created ({} skipped unknown stop, {} skipped unknown mode)",
                batch.size(), skippedUnknownStop, skippedUnknownMode);
    }

    /**
     * Reads {@code translations.txt} when present. The spec requires
     * {@code (table_name, record_id, field_name, language)} or
     * {@code (table_name, field_value, field_name, language)} as the
     * row identifier. We persist both halves and let the runtime
     * lookup pick the record-id form first; the field-value form is
     * usable for future deduplication scenarios.
     */
    private void importTranslations(Path translationsFile) throws IOException {
        translationRepository.deleteAllInBatch();
        translationRepository.flush();

        if (!Files.exists(translationsFile)) {
            log.info("GTFS import: translations.txt missing, skipping");
            return;
        }
        List<Translation> batch = new ArrayList<>();
        // (table, record_id|field_value, field, lang) seen-set so feeds with
        // duplicate translation rows don't blow up the unique constraint.
        Set<String> seen = new HashSet<>();
        int skippedDuplicates = 0;
        try (CSVParser parser = openCsv(translationsFile)) {
            for (CSVRecord record : parser) {
                String tableName = optional(record, "table_name");
                String fieldName = optional(record, "field_name");
                String language = optional(record, "language");
                String translationValue = optional(record, "translation");
                if (isBlank(tableName) || isBlank(fieldName) || isBlank(language) || isBlank(translationValue)) {
                    continue;
                }
                String recordId = optional(record, "record_id");
                String fieldValue = optional(record, "field_value");
                if (isBlank(recordId) && isBlank(fieldValue)) {
                    continue;
                }
                String dedupeKey = tableName + "|" + (isBlank(recordId) ? fieldValue : recordId)
                        + "|" + fieldName + "|" + language;
                if (!seen.add(dedupeKey)) {
                    skippedDuplicates++;
                    continue;
                }
                batch.add(Translation.builder()
                        .tableName(truncate(tableName, 60))
                        .recordId(isBlank(recordId) ? null : truncate(recordId.trim(), 100))
                        .fieldValue(isBlank(fieldValue) ? null : truncate(fieldValue.trim(), 200))
                        .fieldName(truncate(fieldName, 60))
                        .language(truncate(language.trim(), 20))
                        .translation(translationValue)
                        .build());
            }
        }
        if (!batch.isEmpty()) {
            translationRepository.saveAll(batch);
        }
        log.info("GTFS import: {} translations created ({} duplicates skipped)",
                batch.size(), skippedDuplicates);
    }

    /**
     * Reads {@code attributions.txt} when present. Replaces the table
     * (rather than upserting) on every import so credits never linger
     * after the operator drops a line. The file is GTFS-optional —
     * we silently skip when missing.
     */
    private void importAttributions(Path attributionsFile) throws IOException {
        attributionRepository.deleteAllInBatch();
        attributionRepository.flush();

        if (!Files.exists(attributionsFile)) {
            log.info("GTFS import: attributions.txt missing, skipping");
            return;
        }
        List<Attribution> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(attributionsFile)) {
            for (CSVRecord record : parser) {
                String name = optional(record, "organization_name");
                if (isBlank(name)) {continue;}
                batch.add(Attribution.builder()
                        .externalId(truncate(optional(record, "attribution_id"), 100))
                        .organizationName(truncate(name, 200))
                        .producer("1".equals(optional(record, "is_producer")))
                        .operator("1".equals(optional(record, "is_operator")))
                        .authority("1".equals(optional(record, "is_authority")))
                        .agencyExternalId(truncate(optional(record, "agency_id"), 100))
                        .routeExternalId(truncate(optional(record, "route_id"), 100))
                        .tripExternalId(truncate(optional(record, "trip_id"), 100))
                        .url(truncate(optional(record, "attribution_url"), 500))
                        .email(truncate(optional(record, "attribution_email"), 100))
                        .phone(truncate(optional(record, "attribution_phone"), 30))
                        .build());
            }
        }
        if (!batch.isEmpty()) {
            attributionRepository.saveAll(batch);
        }
        log.info("GTFS import: {} attributions created", batch.size());
    }

    /** Resolves a GTFS stop_id to a persisted root Stop, walking through
     *  the parent_station chain the way stop_times does. */
    private static Stop resolveStop(String gtfsStopId, StopImport stopImport) {
        String rootId = stopImport.rootStopIdByGtfsId.get(gtfsStopId);
        if (rootId == null) {return null;}
        return stopImport.stopsByGtfsId.get(rootId);
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

    /**
     * Computes the per-schedule wheelchair override. Returns null when the
     * trip's value matches the itinerary's default (the common case, so
     * the schedule row stores nothing). Returns true/false only when the
     * trip explicitly diverges.
     */
    private static Boolean computeWheelchairOverride(int tripWheelchair,
            com.transit.hub.domain.model.enums.WheelchairAccess itineraryDefault) {
        if (tripWheelchair == 1) {
            return itineraryDefault == com.transit.hub.domain.model.enums.WheelchairAccess.ACCESSIBLE
                    ? null : Boolean.TRUE;
        }
        if (tripWheelchair == 2) {
            return itineraryDefault == com.transit.hub.domain.model.enums.WheelchairAccess.NOT_ACCESSIBLE
                    ? null : Boolean.FALSE;
        }
        return null; // unknown — inherit from itinerary
    }

    /**
     * Computes the per-schedule bikes override following the same
     * null-means-inherit rule as {@link #computeWheelchairOverride}.
     */
    private static Boolean computeBikesOverride(int tripBikes,
            com.transit.hub.domain.model.enums.BikesAllowed itineraryDefault) {
        if (tripBikes == 1) {
            return itineraryDefault == com.transit.hub.domain.model.enums.BikesAllowed.ALLOWED
                    ? null : Boolean.TRUE;
        }
        if (tripBikes == 2) {
            return itineraryDefault == com.transit.hub.domain.model.enums.BikesAllowed.NOT_ALLOWED
                    ? null : Boolean.FALSE;
        }
        return null;
    }

    /**
     * Majority vote on {@code bikes_allowed} mirroring {@link #majorityWheelchair}.
     */
    private static com.transit.hub.domain.model.enums.BikesAllowed majorityBikes(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        int yes = 0;
        int no = 0;
        for (TripInfo info : tripInfos.values()) {
            if (!info.routeId.equals(key.routeId)) {continue;}
            if (!info.directionId.equals(key.directionId)) {continue;}
            if (info.bikesAllowed == 1) { yes++; }
            else if (info.bikesAllowed == 2) { no++; }
        }
        if (yes == 0 && no == 0) {
            return com.transit.hub.domain.model.enums.BikesAllowed.UNKNOWN;
        }
        if (yes > no) {
            return com.transit.hub.domain.model.enums.BikesAllowed.ALLOWED;
        }
        if (no > yes) {
            return com.transit.hub.domain.model.enums.BikesAllowed.NOT_ALLOWED;
        }
        return com.transit.hub.domain.model.enums.BikesAllowed.UNKNOWN;
    }

    /**
     * Picks the dominant {@code wheelchair_accessible} value among the trips
     * of a given (route, direction). Counts {@code 1} (accessible) vs
     * {@code 2} (not accessible); ignores {@code 0} (unknown). Falls back
     * to {@code UNKNOWN} when every trip is unspecified or evenly split.
     */
    private static com.transit.hub.domain.model.enums.WheelchairAccess majorityWheelchair(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        int yes = 0;
        int no = 0;
        for (TripInfo info : tripInfos.values()) {
            if (!info.routeId.equals(key.routeId)) {continue;}
            if (!info.directionId.equals(key.directionId)) {continue;}
            if (info.wheelchairAccessible == 1) { yes++; }
            else if (info.wheelchairAccessible == 2) { no++; }
        }
        if (yes == 0 && no == 0) {
            return com.transit.hub.domain.model.enums.WheelchairAccess.UNKNOWN;
        }
        if (yes > no) {
            return com.transit.hub.domain.model.enums.WheelchairAccess.ACCESSIBLE;
        }
        if (no > yes) {
            return com.transit.hub.domain.model.enums.WheelchairAccess.NOT_ACCESSIBLE;
        }
        return com.transit.hub.domain.model.enums.WheelchairAccess.UNKNOWN;
    }

    /**
     * Routes a GTFS {@code agency_id} to its persisted {@link Agency}.
     * Falls back to the single agency when the feed has exactly one and
     * the route omits {@code agency_id} (the GTFS spec permits this).
     * Returns {@code null} when no agency was loaded — lines without an
     * agency are still valid; the timezone resolver knows how to deal
     * with that.
     */
    private static Agency resolveAgency(String agencyId, Map<String, Agency> agencies) {
        if (agencies.isEmpty()) {return null;}
        if (!isBlank(agencyId)) {
            Agency match = agencies.get(agencyId.trim());
            if (match != null) {return match;}
        }
        if (agencies.size() == 1) {
            return agencies.values().iterator().next();
        }
        return null;
    }

    /**
     * Resolves the text color for a line: keep the GTFS-provided
     * {@code route_text_color} when usable, otherwise derive a
     * contrast-safe value from the background color via the YIQ
     * luminance formula. Always returns an upper-cased {@code "#RRGGBB"}
     * literal so the column is uniform regardless of feed quirks.
     */
    private static String resolveTextColor(String rawTextColor, String backgroundColor) {
        if (!isBlank(rawTextColor)) {
            String trimmed = rawTextColor.trim();
            String hex = trimmed.startsWith("#") ? trimmed : "#" + trimmed;
            if (hex.matches("^#[0-9A-Fa-f]{6}$")) {
                return hex.toUpperCase();
            }
        }
        return ColorContrast.readableTextColor(backgroundColor);
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

    private static Integer parseIntOrNull(String s) {
        if (isBlank(s)) {
            return null;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return null;
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
