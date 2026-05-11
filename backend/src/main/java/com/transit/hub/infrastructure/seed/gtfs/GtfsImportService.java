package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.Attribution;
import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.Location;
import com.transit.hub.domain.model.FareAttribute;
import com.transit.hub.domain.model.FareRule;
import com.transit.hub.domain.model.FeedInfo;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.model.LocationGroup;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.Shape;
import com.transit.hub.domain.model.ShapePoint;
import com.transit.hub.domain.model.ServiceCalendarException;
import com.transit.hub.domain.model.StationLevel;
import com.transit.hub.domain.model.Translation;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.Transfer;
import com.transit.hub.domain.model.enums.BookingType;
import com.transit.hub.domain.model.enums.FarePaymentMethod;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.PathwayMode;
import com.transit.hub.domain.model.enums.ServiceExceptionType;
import com.transit.hub.domain.util.ColorContrast;
import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.FareLegJoinRule;
import com.transit.hub.domain.model.FareLegRule;
import com.transit.hub.domain.model.FareMedia;
import com.transit.hub.domain.model.FareProduct;
import com.transit.hub.domain.model.FareTransferRule;
import com.transit.hub.domain.model.Network;
import com.transit.hub.domain.model.Timeframe;
import com.transit.hub.infrastructure.persistence.AgencyRepository;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.seed.gtfs.sections.AgencyImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.RouteImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.ShapeImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.StationLevelImporter;
import com.transit.hub.infrastructure.persistence.AttributionRepository;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
import com.transit.hub.infrastructure.persistence.FareLegJoinRuleRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.FareMediaRepository;
import com.transit.hub.infrastructure.persistence.FareProductRepository;
import com.transit.hub.infrastructure.persistence.FareTransferRuleRepository;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import com.transit.hub.infrastructure.persistence.RiderCategoryRepository;
import com.transit.hub.infrastructure.persistence.NetworkRepository;
import com.transit.hub.infrastructure.persistence.TimeframeRepository;
import com.transit.hub.infrastructure.persistence.FeedInfoRepository;
import com.transit.hub.infrastructure.persistence.LocationGroupRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.ShapeRepository;
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
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipFile;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.firstNonBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDirectionId;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseShortOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;

/**
 * Imports a standard GTFS feed into the application's domain model.
 * Network-agnostic: works with any GTFS-compliant feed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GtfsImportService {

    private static final int LINE_NAME_MAX_LENGTH = 100;
    private static final int STOP_NAME_MAX_LENGTH = 100;
    private static final double SCHEMATIC_SIZE = 1000.0;
    private static final double SCHEMATIC_MARGIN = 50.0;

    private final AgencyImporter agencyImporter;
    private final RouteImporter routeImporter;
    private final ShapeImporter shapeImporter;
    private final StationLevelImporter stationLevelImporter;

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
    private final FareAttributeRepository fareAttributeRepository;
    private final ShapeRepository shapeRepository;
    private final LocationGroupRepository locationGroupRepository;
    private final com.transit.hub.infrastructure.persistence.LocationRepository locationRepository;
    private final BookingRuleRepository bookingRuleRepository;
    private final AreaRepository areaRepository;
    private final TimeframeRepository timeframeRepository;
    private final FareProductRepository fareProductRepository;
    private final FareLegRuleRepository fareLegRuleRepository;
    private final FareTransferRuleRepository fareTransferRuleRepository;
    private final NetworkRepository networkRepository;
    private final FareMediaRepository fareMediaRepository;
    private final FareLegJoinRuleRepository fareLegJoinRuleRepository;
    private final FlexStopTimeRepository flexStopTimeRepository;
    private final RiderCategoryRepository riderCategoryRepository;

    /** Flushed at section boundaries so the persistence context stays
     *  bounded — without periodic flushes, each section's saveAll
     *  accumulates the prior sections' dirty entities and Hibernate's
     *  BatchSorter can't topologically order the combined batch
     *  (HHH90032022). order_inserts itself stays on so individual
     *  section flushes keep their FK ordering guarantees. */
    @jakarta.persistence.PersistenceContext
    private jakarta.persistence.EntityManager entityManager;

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

            // Flush each upstream section so the next one's saveAll
            // doesn't bundle their pending statements into a single
            // unsortable batch. Each flush still respects order_inserts.
            entityManager.flush();

            Map<String, Shape> shapesByGtfsId = importShapes(workDir.resolve("shapes.txt"));
            entityManager.flush();

            ItineraryImport itineraryImport = importItineraries(
                    workDir.resolve("trips.txt"),
                    workDir.resolve("stop_times.txt"),
                    linesByGtfsId,
                    stopImport,
                    shapesByGtfsId);
            entityManager.flush();

            Map<String, List<FrequencyWindow>> frequencies = loadFrequencies(workDir.resolve("frequencies.txt"));

            // Booking rules must land before schedules so each Schedule can
            // resolve its pickup_booking_rule_id / drop_off_booking_rule_id
            // FK during import. The rules table is small, so loading it
            // upfront has no measurable cost.
            Map<String, BookingRule> bookingRules = importBookingRules(workDir.resolve("booking_rules.txt"));

            // Locations + location groups must land before schedules so the
            // flex_stop_times rows materialised inside importSchedules can
            // resolve their location_id / location_group_id FKs in a single
            // pass.
            importLocations(workDir.resolve("locations.geojson"));
            importLocationGroups(workDir, stopImport);

            int schedules = importSchedules(workDir, itineraryImport, stopImport, frequencies, bookingRules);

            importTransfers(workDir.resolve("transfers.txt"), stopImport);

            importStationLevels(workDir.resolve("levels.txt"));

            importPathways(workDir.resolve("pathways.txt"), stopImport);

            importTranslations(workDir.resolve("translations.txt"));

            importFares(workDir, linesByGtfsId, agenciesByGtfsId);

            importFaresV2(workDir, stopImport, linesByGtfsId);

            importAttributions(workDir.resolve("attributions.txt"));

            assignSchematicCoordinates(stopImport.stopsByGtfsId.values());

            validateGlobalIdUniqueness();

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

    private Map<String, Agency> importAgencies(Path agenciesFile) throws IOException {
        return agencyImporter.importAgencies(agenciesFile);
    }

    private Map<String, Line> importRoutes(Path routesFile, Map<String, Agency> agencies)
            throws IOException {
        return routeImporter.importRoutes(routesFile, agencies);
    }


    /**
     * Persisted-stop lookup keyed by the GTFS {@code stop_id}. Phase
     * 1.3 keeps every platform and parent station as its own row, so
     * downstream consumers (schedules, itineraries, transfers, areas,
     * pathways) just resolve their {@code stop_id} reference directly
     * — no parent-collapse walk anymore.
     */
    private record StopImport(Map<String, Stop> stopsByGtfsId) {}

    private StopImport importStops(Path stopsFile) throws IOException {
        record RawStop(String id, String name, Double lat, Double lon, String parent, int locationType,
                       String shortCode, String ttsName, String timezone, String description, String url,
                       int wheelchairBoarding, String platformCode, String zoneId,
                       Short stopAccess) {}

        List<RawStop> raw = new ArrayList<>();
        try (CSVParser parser = openCsv(stopsFile)) {
            for (CSVRecord record : parser) {
                int locationType = parseInt(optional(record, "location_type"), 0);
                // Phase 1.3: keep platforms (0) and parent stations (1).
                // Skip entrances/exits (2), generic nodes (3), boarding
                // areas (4) — none are referenced by stop_times.
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
                        optional(record, "platform_code"),
                        optional(record, "zone_id"),
                        parseShortOrNull(optional(record, "stop_access"))));
            }
        }

        // Pre-load existing stops by external_id so re-imports keep the
        // same UUID — Devices reference Stop.id directly, and dropping
        // the row on re-import would unbind every kiosk in the field.
        // See ADR 0013.
        Map<String, Stop> existingByExternalId = stopRepository.findAll().stream()
                .filter(s -> s.getExternalId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        Stop::getExternalId, java.util.function.Function.identity(),
                        (a, b) -> a));

        // Two-pass persistence: parent stations first (so children can
        // reference them via parentStop FK), then platforms.
        Map<String, Stop> result = new LinkedHashMap<>();
        Set<UUID> seenIds = new HashSet<>();
        java.util.function.BiConsumer<RawStop, Stop> persist = (r, parent) -> {
            if (isBlank(r.name)) {return;}
            String externalId = truncate(r.id, 100);
            Stop stop = existingByExternalId.containsKey(externalId)
                    ? existingByExternalId.get(externalId)
                    : new Stop();
            stop.setExternalId(externalId);
            stop.setName(truncate(r.name, STOP_NAME_MAX_LENGTH));
            stop.setLatitude(r.lat);
            stop.setLongitude(r.lon);
            stop.setShortCode(truncate(r.shortCode, 50));
            stop.setTtsName(truncate(r.ttsName, 150));
            stop.setStopTimezone(truncate(r.timezone, 60));
            stop.setDescription(truncate(r.description, 500));
            stop.setUrl(truncate(r.url, 255));
            stop.setWheelchairBoarding(
                    com.transit.hub.domain.model.enums.WheelchairAccess.fromGtfs(r.wheelchairBoarding));
            stop.setPlatformCode(isBlank(r.platformCode) ? null : truncate(r.platformCode, 10));
            stop.setZoneId(isBlank(r.zoneId) ? null : truncate(r.zoneId, 100));
            stop.setStopAccess(r.stopAccess);
            stop.setLocationType((short) r.locationType);
            stop.setParentStop(parent);
            // Re-enable on every import: a stop that disappeared in a
            // previous feed and reappears in the current one should
            // become live again.
            stop.setDisabled(false);
            Stop saved = stopRepository.save(stop);
            seenIds.add(saved.getId());
            result.put(r.id, saved);
        };

        // Pass 1: parent stations. Platforms whose declared parent
        // isn't in the feed at all (broken reference) are kept as
        // free-standing in pass 2.
        for (RawStop r : raw) {
            if (r.locationType == 1) {persist.accept(r, null);}
        }
        // Flush parents before pass 2 so the platform inserts in pass 2
        // see their FK already in the DB. Without this flush the two
        // passes' inserts mingle in one action queue and Hibernate's
        // BatchSorter can't topologically order the self-referential
        // Stop → Stop FKs (HHH90032022).
        entityManager.flush();
        // Pass 2: platforms (location_type=0). The parent FK resolves
        // against the pass-1 map; missing parents fall through to null.
        for (RawStop r : raw) {
            if (r.locationType != 1) {
                Stop parent = isBlank(r.parent) ? null : result.get(r.parent);
                persist.accept(r, parent);
            }
        }
        entityManager.flush();
        // Stops the new feed no longer declares: flag disabled rather
        // than delete so Devices keep their stop_id FK valid. The kiosk
        // still gets a clean "stop removed" payload via existing event
        // handling on disabled toggle (StopService treats disabled as
        // a soft-delete from the operator's perspective).
        int disabled = 0;
        for (Stop old : existingByExternalId.values()) {
            if (!seenIds.contains(old.getId()) && !old.isDisabled()) {
                old.setDisabled(true);
                stopRepository.save(old);
                disabled++;
            }
        }
        long parents = result.values().stream().filter(s -> s.getLocationType() == 1).count();
        log.info("GTFS import: {} stops upserted ({} platforms, {} stations, {} flagged disabled)",
                result.size(), result.size() - parents, parents, disabled);
        return new StopImport(result);
    }


    private record ItineraryImport(
            int itineraryCount,
            int itineraryStopCount,
            Map<String, TripInfo> tripInfos,
            Map<RouteDirKey, Itinerary> itinerariesByRouteDir) {}

    private record TripInfo(String routeId, String directionId, String serviceId, String headsign,
                            int wheelchairAccessible, int bikesAllowed, int carsAllowed,
                            Double safeDurationFactor, Double safeDurationOffset,
                            Double meanDurationFactor, Double meanDurationOffset,
                            String blockId, String shapeId) {}

    /** A single frequency window from frequencies.txt, opening from
     *  {@code start} (inclusive) to {@code end} (exclusive) with a
     *  recurring trip every {@code headwaySeconds}. {@code exactTimes}
     *  follows the GTFS convention: 1 = schedule-based replication,
     *  0/null = headway-based (passenger expectation tracks "every X
     *  min"). Times are GTFS wall-clock so a window crossing midnight
     *  (start &gt; end after mod-24 folding) is normalised by the
     *  iterator below. */
    private record FrequencyWindow(LocalTime start, LocalTime end,
                                   int headwaySeconds, Boolean exactTimes) {}

    private record RouteDirKey(String routeId, String directionId) {}

    private ItineraryImport importItineraries(
            Path tripsFile,
            Path stopTimesFile,
            Map<String, Line> linesByGtfsId,
            StopImport stopImport,
            Map<String, Shape> shapesByGtfsId) throws IOException {

        // 1. Read trips into memory
        Map<String, TripInfo> tripInfos = new HashMap<>();
        try (CSVParser parser = openCsv(tripsFile)) {
            for (CSVRecord record : parser) {
                String rawBlockId = optional(record, "block_id");
                String rawShapeId = optional(record, "shape_id");
                tripInfos.put(record.get("trip_id"), new TripInfo(
                        record.get("route_id"),
                        firstNonBlank(optional(record, "direction_id"), "0"),
                        optional(record, "service_id"),
                        optional(record, "trip_headsign"),
                        parseInt(optional(record, "wheelchair_accessible"), 0),
                        parseInt(optional(record, "bikes_allowed"), 0),
                        parseInt(optional(record, "cars_allowed"), 0),
                        parseDoubleOrNull(optional(record, "safe_duration_factor")),
                        parseDoubleOrNull(optional(record, "safe_duration_offset")),
                        parseDoubleOrNull(optional(record, "mean_duration_factor")),
                        parseDoubleOrNull(optional(record, "mean_duration_offset")),
                        isBlank(rawBlockId) ? null : truncate(rawBlockId.trim(), 40),
                        isBlank(rawShapeId) ? null : rawShapeId.trim()));
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

        // Pre-load existing itineraries by external_id so re-imports
        // refresh a stable UUID. The representative trip_id can shift
        // between feeds (a longer variant becomes the most-stops one),
        // in which case the old itinerary becomes orphan and gets
        // dropped at the end of this method. See ADR 0013.
        Map<String, Itinerary> existingItinerariesByExternalId = itineraryRepository.findAll().stream()
                .filter(i -> i.getExternalId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        Itinerary::getExternalId, java.util.function.Function.identity(),
                        (a, b) -> a));

        // Clear stop ↔ line membership before rebuilding so a route
        // reassigning its stops doesn't leave the previous lines
        // permanently attached. The `stop.getLines()` collection is a
        // Set, so adding stays idempotent below.
        for (Stop stop : stopImport.stopsByGtfsId.values()) {
            stop.getLines().clear();
        }

        // 5. Build itineraries
        int itineraryCount = 0;
        int itineraryStopCount = 0;
        Set<Stop> stopsTouched = new HashSet<>();
        Map<RouteDirKey, Itinerary> itinerariesByRouteDir = new HashMap<>();
        Set<UUID> seenItineraryIds = new HashSet<>();

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

            String itineraryName = buildItineraryName(info.headsign, key.directionId);
            // Majority vote on wheelchair_accessible across every trip
            // matching this (route, direction). The representative trip
            // alone would underestimate accessibility on networks where
            // the longest variant happens to be the non-accessible one.
            com.transit.hub.domain.model.enums.WheelchairAccess wheelchairDefault =
                    majorityWheelchair(tripInfos, key);
            com.transit.hub.domain.model.enums.BikesAllowed bikesDefault =
                    majorityBikes(tripInfos, key);
            com.transit.hub.domain.model.enums.CarsAllowed carsDefault =
                    majorityCars(tripInfos, key);

            // Resolve the geographic shape from the representative
            // trip's shape_id. Null = the feed didn't ship a shape for
            // this trip (or shapes.txt was missing entirely), in which
            // case the future map view falls back to stop-to-stop lines.
            Shape shape = (info.shapeId == null) ? null : shapesByGtfsId.get(info.shapeId);

            Short directionId = parseDirectionId(key.directionId);
            String externalId = truncate(tripId, 100);
            Itinerary itinerary = existingItinerariesByExternalId.get(externalId);
            if (itinerary == null) {
                itinerary = Itinerary.builder()
                        .externalId(externalId)
                        .line(line)
                        .name(truncate(itineraryName, LINE_NAME_MAX_LENGTH))
                        .directionId(directionId)
                        .wheelchairDefault(wheelchairDefault)
                        .bikesAllowedDefault(bikesDefault)
                        .carsAllowedDefault(carsDefault)
                        .safeDurationFactor(info.safeDurationFactor)
                        .safeDurationOffset(info.safeDurationOffset)
                        .meanDurationFactor(info.meanDurationFactor)
                        .meanDurationOffset(info.meanDurationOffset)
                        .shape(shape)
                        .itineraryStops(new ArrayList<>())
                        .build();
            } else {
                itinerary.setExternalId(externalId);
                itinerary.setLine(line);
                itinerary.setName(truncate(itineraryName, LINE_NAME_MAX_LENGTH));
                itinerary.setDirectionId(directionId);
                itinerary.setWheelchairDefault(wheelchairDefault);
                itinerary.setCarsAllowedDefault(carsDefault);
                itinerary.setSafeDurationFactor(info.safeDurationFactor);
                itinerary.setSafeDurationOffset(info.safeDurationOffset);
                itinerary.setMeanDurationFactor(info.meanDurationFactor);
                itinerary.setMeanDurationOffset(info.meanDurationOffset);
                itinerary.setBikesAllowedDefault(bikesDefault);
                itinerary.setShape(shape);
                // orphanRemoval=true on the OneToMany picks up the
                // cleared rows when we save the parent again below.
                itinerary.getItineraryStops().clear();
            }
            itinerary = itineraryRepository.save(itinerary);

            int position = 0;
            Set<Stop> seenInItinerary = new HashSet<>();
            for (TimedStop ts : trip) {
                Stop stop = stopImport.stopsByGtfsId.get(ts.stopId);
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
            seenItineraryIds.add(itinerary.getId());
            itineraryCount++;
        }

        // Persist stop ↔ line associations
        stopRepository.saveAll(stopsTouched);

        // Drop itineraries the new feed no longer declares. No FK is
        // semantically attached from outside the import scope (no
        // BroadcastMessage scope=ITINERARY exists), so a hard delete
        // is safe.
        int orphans = 0;
        for (Itinerary old : existingItinerariesByExternalId.values()) {
            if (!seenItineraryIds.contains(old.getId())) {
                itineraryRepository.delete(old);
                orphans++;
            }
        }
        if (orphans > 0) {
            log.info("GTFS import: {} obsolete itineraries removed", orphans);
        }

        log.info("GTFS import: {} itineraries upserted / {} itinerary stops created",
                itineraryCount, itineraryStopCount);
        return new ItineraryImport(itineraryCount, itineraryStopCount, tripInfos, itinerariesByRouteDir);
    }

    /**
     * In-memory parsing buffer. Persisted later as a {@link ServiceCalendar}
     * entity once we know which {@code service_id}s are referenced by trips.
     */
    private record ServiceCalendarSnapshot(
            LocalDate startDate,
            LocalDate endDate,
            Set<DayOfWeek> daysOfWeek,
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
        private Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
        private final Set<LocalDate> added = new HashSet<>();
        private final Set<LocalDate> removed = new HashSet<>();

        void withWeekly(LocalDate start, LocalDate end, Set<DayOfWeek> daysOfWeek) {
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
    private static final long DAY_SECONDS = 24L * 3600L;

    /**
     * Reads {@code frequencies.txt} into a {@code tripId -> List<FrequencyWindow>}
     * map. Each row becomes a separate window so a trip declared for
     * peak / off-peak / late hours fans out into the right number of
     * synthetic departures during the schedule import. Absent file or
     * missing required fields yield an empty list for that trip (which
     * the importer treats as "fixed timetable").
     */
    private Map<String, List<FrequencyWindow>> loadFrequencies(Path frequenciesFile) throws IOException {
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
                if (isBlank(tripId) || headway <= 0 || start == null || end == null) {continue;}
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
     * Reads {@code stop_times.txt} once and returns the earliest wall-clock
     * time per trip, restricted to {@code targetTrips} (typically the trips
     * that have at least one frequency window). The result is the offset
     * anchor for fan-out: every stop_time of a frequency-mode trip is
     * persisted at {@code windowStart + (stopTime - tripStart)}.
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
                if (!targetTrips.contains(tripId)) {continue;}
                LocalTime time = GtfsParse.parseGtfsTime(firstNonBlank(
                        optional(record, "departure_time"),
                        optional(record, "arrival_time")));
                if (time == null) {continue;}
                LocalTime current = result.get(tripId);
                if (current == null || time.isBefore(current)) {
                    result.put(tripId, time);
                }
            }
        }
        return result;
    }

    private int importSchedules(Path workDir, ItineraryImport itineraryImport, StopImport stopImport,
                                Map<String, List<FrequencyWindow>> frequencies,
                                Map<String, BookingRule> bookingRules)
            throws IOException {
        Path stopTimesFile = workDir.resolve("stop_times.txt");
        if (!Files.exists(stopTimesFile)) {
            log.warn("GTFS import: stop_times.txt missing, skipping schedule import");
            return 0;
        }

        // Wipe schedules before re-importing. Phase 0.5c made Lines /
        // Stops / Itineraries idempotent (UUIDs preserved across
        // reimports), and the persisted-calendar refactor of Phase 1.4
        // introduced FK SET NULL on calendar deletion — together those
        // changes meant repeating an import would otherwise pile new
        // schedules on top of orphaned ones with `service_calendar_id`
        // nulled out. Schedules carry no external_id and no Device /
        // BroadcastMessage references, so a clean slate is safe; the
        // boot loader skip-when-seeded guard means installs without
        // GTFS aren't affected. See ADR 0013.
        scheduleRepository.deleteAllInBatch();
        scheduleRepository.flush();

        // Fan-out anchor: every stop_time of a frequency-mode trip is replicated
        // for every (window, k) departure as windowStart + (stopTime - tripStart).
        // We only fetch start times for trips that actually have frequency
        // windows so feeds without frequencies.txt pay zero overhead.
        Map<String, LocalTime> tripStartTimes = loadTripStartTimes(
                workDir.resolve("stop_times.txt"), frequencies.keySet());

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
        List<FlexStopTime> flexBatch = new ArrayList<>(MAX_SCHEDULE_BATCH);
        // Wipe flex_stop_times on every reimport for the same reason
        // schedules get wiped: rows carry no external_id and any orphan
        // would point at a now-stale itinerary FK.
        flexStopTimeRepository.deleteAllInBatch();
        flexStopTimeRepository.flush();
        Map<String, com.transit.hub.domain.model.Location> locationsByExternalId =
                locationRepository.findAll().stream()
                        .filter(l -> l.getExternalId() != null)
                        .collect(java.util.stream.Collectors.toMap(
                                com.transit.hub.domain.model.Location::getExternalId,
                                java.util.function.Function.identity(),
                                (a, b) -> a));
        Map<String, com.transit.hub.domain.model.LocationGroup> locationGroupsByExternalId =
                locationGroupRepository.findAll().stream()
                        .filter(l -> l.getExternalId() != null)
                        .collect(java.util.stream.Collectors.toMap(
                                com.transit.hub.domain.model.LocationGroup::getExternalId,
                                java.util.function.Function.identity(),
                                (a, b) -> a));
        int total = 0;
        int flexTotal = 0;
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

                // GTFS-flex: the row addresses a polygon (location_id) or a
                // group of stops (location_group_id) instead of a fixed
                // stop, with a pickup/drop-off time window in place of
                // arrival_time. Route those rows to flex_stop_times rather
                // than schedules — they describe on-demand availability,
                // not a concrete arrival. See ADR 0030.
                String flexLocationId = optional(record, "location_id");
                String flexLocationGroupId = optional(record, "location_group_id");
                String flexStopId = optional(record, "stop_id");
                LocalTime flexStartWindow = GtfsParse.parseGtfsTime(
                        optional(record, "start_pickup_drop_off_window"));
                LocalTime flexEndWindow = GtfsParse.parseGtfsTime(
                        optional(record, "end_pickup_drop_off_window"));
                LocalTime flexArrival = GtfsParse.parseGtfsTime(optional(record, "arrival_time"));
                // A row is a flex window when it carries a window AND
                // either targets a polygon (location_id) / a group of
                // stops (location_group_id), OR targets a fixed stop
                // (stop_id) without any concrete arrival time. The
                // last variant covers feeds that surface a "you can
                // be picked up here on request between 17h and 18h30"
                // entry on a regular stop — the spec allows it and
                // {@code TAD_LANDMARK} in the bundled rich fixture
                // exercises this code path.
                boolean isFlexRow = flexStartWindow != null && flexEndWindow != null
                        && (!isBlank(flexLocationId)
                            || !isBlank(flexLocationGroupId)
                            || (!isBlank(flexStopId) && flexArrival == null));
                if (isFlexRow) {
                    flexBatch.add(buildFlexStopTime(record, itinerary, calendar,
                            stopImport, locationsByExternalId, locationGroupsByExternalId,
                            bookingRules, flexStartWindow, flexEndWindow));
                    if (flexBatch.size() >= MAX_SCHEDULE_BATCH) {
                        flexStopTimeRepository.saveAll(flexBatch);
                        flexTotal += flexBatch.size();
                        flexBatch.clear();
                    }
                    continue;
                }

                Stop stop = stopImport.stopsByGtfsId.get(record.get("stop_id"));
                if (stop == null) {continue;}

                LocalTime arrivalTime = GtfsParse.parseGtfsTime(optional(record, "arrival_time"));
                LocalTime departureTime = GtfsParse.parseGtfsTime(optional(record, "departure_time"));
                // The spec lets a feed declare only one of the two: the
                // missing field implicitly equals the present one. Pick
                // arrival as the display "time" and persist departure
                // separately only when the feed actually distinguishes
                // them.
                LocalTime time = arrivalTime != null ? arrivalTime : departureTime;
                if (time == null) {continue;}
                LocalTime distinctDeparture =
                        (departureTime != null && !departureTime.equals(time)) ? departureTime : null;

                short pickupType = (short) parseInt(optional(record, "pickup_type"), 0);
                short dropOffType = (short) parseInt(optional(record, "drop_off_type"), 0);
                // (1, 1) means "no service at this stop_time" per the GTFS spec.
                // Filter so the row never shows up on a kiosk as a phantom arrival.
                if (pickupType == 1 && dropOffType == 1) {continue;}

                Short continuousPickup = parseShortOrNull(optional(record, "continuous_pickup"));
                Short continuousDropOff = parseShortOrNull(optional(record, "continuous_drop_off"));
                Double shapeDistTraveled = parseDoubleOrNull(optional(record, "shape_dist_traveled"));

                // Wheelchair / bikes overrides: only stored when the trip's
                // value diverges from the itinerary's majority default. Saves
                // ~2 bytes × millions of rows on most feeds.
                Boolean wheelchairOverride = computeWheelchairOverride(trip.wheelchairAccessible,
                        itinerary.getWheelchairDefault()).orElse(null);
                Boolean bikesOverride = computeBikesOverride(trip.bikesAllowed,
                        itinerary.getBikesAllowedDefault()).orElse(null);
                // GTFS timepoint defaults to "exact" when omitted; only an
                // explicit 0 means the time is approximate.
                String timepointRaw = optional(record, "timepoint");
                boolean timepoint = isBlank(timepointRaw) || !"0".equals(timepointRaw.trim());

                // TAD bookings: stop_times.pickup_booking_rule_id /
                // drop_off_booking_rule_id reference booking_rules.txt by id.
                // Looked up against the map populated upstream so the FK is
                // set in the same insert as the schedule row.
                BookingRule pickupBooking = bookingRules.get(optional(record, "pickup_booking_rule_id"));
                BookingRule dropOffBooking = bookingRules.get(optional(record, "drop_off_booking_rule_id"));

                List<FrequencyWindow> windows = frequencies.get(tripId);

                if (windows == null || windows.isEmpty()) {
                    // Fixed timetable: persist the stop_time as-is.
                    ScheduleKey key = new ScheduleKey(stop.getId(), itinerary.getId(), time, calendar.getId());
                    if (!seen.add(key)) {continue;}
                    batch.add(Schedule.builder()
                            .time(time)
                            .departureTime(distinctDeparture)
                            .stop(stop)
                            .itinerary(itinerary)
                            .pickupType(pickupType)
                            .dropOffType(dropOffType)
                            .wheelchairOverride(wheelchairOverride)
                            .bikesAllowedOverride(bikesOverride)
                            .timepoint(timepoint)
                            .frequencyHeadwaySeconds(null)
                            .frequencyExactTimes(null)
                            .blockId(trip.blockId)
                            .serviceCalendar(calendar)
                            .pickupBookingRule(pickupBooking)
                            .dropOffBookingRule(dropOffBooking)
                            .continuousPickup(continuousPickup)
                            .continuousDropOff(continuousDropOff)
                            .shapeDistTraveled(shapeDistTraveled)
                            .build());
                    if (batch.size() >= MAX_SCHEDULE_BATCH) {
                        scheduleRepository.saveAll(batch);
                        total += batch.size();
                        batch.clear();
                        log.debug("GTFS import: {} schedules persisted so far", total);
                    }
                    continue;
                }

                // Fan-out: replicate the stop_time across every frequency window
                // as windowStart + (stopTime - tripStart). The dedupe set absorbs
                // collisions between overlapping windows on the same trip.
                LocalTime tripStart = tripStartTimes.get(tripId);
                if (tripStart == null) {continue;}
                long deltaSeconds = ((long) time.toSecondOfDay() - tripStart.toSecondOfDay() + DAY_SECONDS)
                        % DAY_SECONDS;

                for (FrequencyWindow window : windows) {
                    long winStart = window.start.toSecondOfDay();
                    long winEnd = window.end.toSecondOfDay();
                    // Window crossing midnight: end falls earlier than start
                    // because parseGtfsTime folds hours mod 24. Shift end up
                    // by a full day so the iterator emits the right count.
                    if (winEnd <= winStart) {winEnd += DAY_SECONDS;}

                    for (long ts = winStart; ts < winEnd; ts += window.headwaySeconds) {
                        LocalTime stopTime = LocalTime.ofSecondOfDay((ts + deltaSeconds) % DAY_SECONDS);
                        ScheduleKey key = new ScheduleKey(stop.getId(), itinerary.getId(),
                                stopTime, calendar.getId());
                        if (!seen.add(key)) {continue;}
                        batch.add(Schedule.builder()
                                .time(stopTime)
                                .stop(stop)
                                .itinerary(itinerary)
                                .pickupType(pickupType)
                                .dropOffType(dropOffType)
                                .wheelchairOverride(wheelchairOverride)
                                .bikesAllowedOverride(bikesOverride)
                                .timepoint(timepoint)
                                .frequencyHeadwaySeconds(window.headwaySeconds)
                                .frequencyExactTimes(window.exactTimes)
                                .blockId(trip.blockId)
                                .serviceCalendar(calendar)
                                .pickupBookingRule(pickupBooking)
                                .dropOffBookingRule(dropOffBooking)
                                .continuousPickup(continuousPickup)
                                .continuousDropOff(continuousDropOff)
                                .shapeDistTraveled(shapeDistTraveled)
                                .build());
                        if (batch.size() >= MAX_SCHEDULE_BATCH) {
                            scheduleRepository.saveAll(batch);
                            total += batch.size();
                            batch.clear();
                            log.debug("GTFS import: {} schedules persisted so far", total);
                        }
                    }
                }
            }
        }

        if (!batch.isEmpty()) {
            scheduleRepository.saveAll(batch);
            total += batch.size();
        }
        if (!flexBatch.isEmpty()) {
            flexStopTimeRepository.saveAll(flexBatch);
            flexTotal += flexBatch.size();
        }

        if (skippedNoCalendar > 0) {
            log.warn("GTFS import: skipped {} stop_times rows whose trip references an unknown service_id",
                    skippedNoCalendar);
        }
        log.info("GTFS import: {} schedules + {} flex stop_times created across {} service calendars",
                total, flexTotal, services.size());
        return total;
    }

    /** Builds a {@link FlexStopTime} from a stop_times.txt row whose
     *  pickup/drop-off applies over a polygon (location_id) or a group
     *  of stops (location_group_id). Spec dictates the three target
     *  refs (stop_id, location_id, location_group_id) are mutually
     *  exclusive — we honour location_id over location_group_id over
     *  stop_id when more than one is set, but log nothing because
     *  feeds in the wild occasionally tag both for redundancy. */
    private FlexStopTime buildFlexStopTime(CSVRecord record, Itinerary itinerary,
                                           ServiceCalendar calendar,
                                           StopImport stopImport,
                                           Map<String, com.transit.hub.domain.model.Location> locations,
                                           Map<String, com.transit.hub.domain.model.LocationGroup> locationGroups,
                                           Map<String, BookingRule> bookingRules,
                                           LocalTime startWindow, LocalTime endWindow) {
        String locationId = optional(record, "location_id");
        String locationGroupId = optional(record, "location_group_id");
        String stopId = optional(record, "stop_id");
        com.transit.hub.domain.model.Location location =
                isBlank(locationId) ? null : locations.get(locationId);
        com.transit.hub.domain.model.LocationGroup locationGroup =
                (location == null && !isBlank(locationGroupId))
                        ? locationGroups.get(locationGroupId) : null;
        Stop stop = (location == null && locationGroup == null && !isBlank(stopId))
                ? stopImport.stopsByGtfsId.get(stopId) : null;

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
                    Set<DayOfWeek> days = EnumSet.noneOf(DayOfWeek.class);
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
                        .fromRouteId(truncate(optional(record, "from_route_id"), 100))
                        .toRouteId(truncate(optional(record, "to_route_id"), 100))
                        .fromTripId(truncate(optional(record, "from_trip_id"), 100))
                        .toTripId(truncate(optional(record, "to_trip_id"), 100))
                        .build());
            }
        }
        if (!batch.isEmpty()) {
            transferRepository.saveAll(batch);
        }
        log.info("GTFS import: {} transfers created ({} rows skipped — unknown stop)",
                batch.size(), skippedUnknownStop);
    }

    private Map<String, Shape> importShapes(Path shapesFile) throws IOException {
        return shapeImporter.importShapes(shapesFile);
    }

    private void importStationLevels(Path levelsFile) throws IOException {
        stationLevelImporter.importStationLevels(levelsFile);
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
                String recordSubId = optional(record, "record_sub_id");
                String languageContext = optional(record, "language_context");
                String dedupeKey = tableName + "|" + (isBlank(recordId) ? fieldValue : recordId)
                        + "|" + (recordSubId == null ? "" : recordSubId)
                        + "|" + fieldName + "|" + language;
                if (!seen.add(dedupeKey)) {
                    skippedDuplicates++;
                    continue;
                }
                batch.add(Translation.builder()
                        .tableName(truncate(tableName, 60))
                        .recordId(isBlank(recordId) ? null : truncate(recordId.trim(), 100))
                        .fieldValue(isBlank(fieldValue) ? null : truncate(fieldValue.trim(), 200))
                        .recordSubId(isBlank(recordSubId) ? null : truncate(recordSubId.trim(), 100))
                        .languageContext(isBlank(languageContext) ? null : truncate(languageContext.trim(), 100))
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
     * Reads GTFS Fares v1 ({@code fare_attributes.txt} +
     * {@code fare_rules.txt}). Wipes both tables first so each import
     * starts from a clean slate. The pair is GTFS-optional; when
     * {@code fare_attributes.txt} is missing we skip the entire fare
     * pipeline rather than persisting orphan rules.
     */
    private void importFares(Path workDir, Map<String, Line> linesByGtfsId,
                             Map<String, Agency> agenciesByGtfsId) throws IOException {
        fareAttributeRepository.deleteAllInBatch();
        fareAttributeRepository.flush();

        Path fareAttributesFile = workDir.resolve("fare_attributes.txt");
        if (!Files.exists(fareAttributesFile)) {
            log.info("GTFS import: fare_attributes.txt missing, skipping fares");
            return;
        }

        Map<String, FareAttribute> attributesByGtfsId = new HashMap<>();
        int skippedAttrs = 0;
        try (CSVParser parser = openCsv(fareAttributesFile)) {
            for (CSVRecord record : parser) {
                String fareId = optional(record, "fare_id");
                String priceRaw = optional(record, "price");
                String currency = optional(record, "currency_type");
                if (isBlank(fareId) || isBlank(priceRaw) || isBlank(currency)) {
                    skippedAttrs++;
                    continue;
                }
                java.math.BigDecimal price;
                try {
                    price = new java.math.BigDecimal(priceRaw.trim());
                } catch (NumberFormatException e) {
                    skippedAttrs++;
                    continue;
                }
                int paymentCode = parseInt(optional(record, "payment_method"), 0);
                Integer transfers = parseTransfersField(optional(record, "transfers"));
                Integer transferDuration = parseIntOrNull(optional(record, "transfer_duration"));
                Agency agency = resolveAgency(optional(record, "agency_id"), agenciesByGtfsId);

                FareAttribute attr = FareAttribute.builder()
                        .externalId(truncate(fareId.trim(), 100))
                        .price(price)
                        .currency(truncate(currency.trim().toUpperCase(java.util.Locale.ROOT), 3))
                        .paymentMethod(FarePaymentMethod.fromGtfsCode(paymentCode))
                        .transfers(transfers)
                        .transferDuration(transferDuration)
                        .agency(agency)
                        .build();
                attributesByGtfsId.put(fareId, fareAttributeRepository.save(attr));
            }
        }
        if (skippedAttrs > 0) {
            log.warn("GTFS import: skipped {} malformed fare_attributes.txt rows", skippedAttrs);
        }
        log.info("GTFS import: {} fare attributes persisted", attributesByGtfsId.size());

        // fare_rules.txt is optional — when absent, fare_attributes alone
        // describe a flat fare that applies to every trip in the feed.
        Path fareRulesFile = workDir.resolve("fare_rules.txt");
        if (!Files.exists(fareRulesFile)) {
            log.info("GTFS import: fare_rules.txt missing, fare attributes will apply unconditionally");
            return;
        }
        int rulesPersisted = 0;
        int skippedRules = 0;
        try (CSVParser parser = openCsv(fareRulesFile)) {
            for (CSVRecord record : parser) {
                String fareId = optional(record, "fare_id");
                if (isBlank(fareId)) {
                    skippedRules++;
                    continue;
                }
                FareAttribute attr = attributesByGtfsId.get(fareId);
                if (attr == null) {
                    skippedRules++;
                    continue;
                }
                Line route = null;
                String routeId = optional(record, "route_id");
                if (!isBlank(routeId)) {
                    route = linesByGtfsId.get(routeId);
                }
                FareRule rule = FareRule.builder()
                        .fareAttribute(attr)
                        .route(route)
                        .originId(truncate(optional(record, "origin_id"), 100))
                        .destinationId(truncate(optional(record, "destination_id"), 100))
                        .containsId(truncate(optional(record, "contains_id"), 100))
                        .build();
                attr.getRules().add(rule);
                rulesPersisted++;
            }
        }
        // Attributes already saved; cascade on the rules collection picks
        // up the new rows when we save the parent again.
        fareAttributeRepository.saveAll(attributesByGtfsId.values());
        if (skippedRules > 0) {
            log.warn("GTFS import: skipped {} fare_rules.txt rows referencing unknown fare_id", skippedRules);
        }
        log.info("GTFS import: {} fare rules persisted", rulesPersisted);
    }

    /**
     * GTFS encodes "unlimited transfers" by leaving the cell empty —
     * this differs from "0 transfers" which is "no transfers allowed".
     * Returning {@code null} preserves that distinction.
     */
    private Integer parseTransfersField(String raw) {
        if (isBlank(raw)) {return null;}
        return parseIntOrNull(raw.trim());
    }

    /**
     * Imports the GTFS Fares v2 family — areas, timeframes, fare
     * products, leg rules, transfer rules — in dependency order.
     * Each table wipes and re-inserts; cross-references resolve via
     * the maps built up as we go.
     *
     * v2 coexists with v1 (which {@link #importFares} populates):
     * feeds in transition often ship both, and the kiosk can prefer
     * v2 when present without dropping v1 data.
     *
     * Skipped GTFS-v2 files (kept as raw strings or unimported):
     *   - networks.txt / route_networks.txt → leg rules store the
     *     network_id verbatim, no FK.
     *   - fare_media.txt → products store the fare_media_id verbatim.
     *   - fare_leg_join_rules.txt → not consumed by any current
     *     surface, niche.
     */
    private void importFaresV2(Path workDir, StopImport stopImport,
                               Map<String, Line> linesByGtfsId) throws IOException {
        // Order matters: leg rules reference areas / products, transfer
        // rules reference products. Wipe the dependents first so FK
        // SET NULL doesn't fire spuriously during the rebuild.
        fareLegJoinRuleRepository.deleteAllInBatch();
        fareTransferRuleRepository.deleteAllInBatch();
        fareLegRuleRepository.deleteAllInBatch();
        fareProductRepository.deleteAllInBatch();
        riderCategoryRepository.deleteAllInBatch();
        fareMediaRepository.deleteAllInBatch();
        timeframeRepository.deleteAllInBatch();
        areaRepository.deleteAllInBatch();
        networkRepository.deleteAllInBatch();
        fareTransferRuleRepository.flush();

        importNetworks(workDir.resolve("networks.txt"),
                workDir.resolve("route_networks.txt"), linesByGtfsId);
        importFareMedia(workDir.resolve("fare_media.txt"));
        importRiderCategories(workDir.resolve("rider_categories.txt"));
        Map<String, Area> areasByExternalId = importAreas(workDir.resolve("areas.txt"),
                workDir.resolve("stop_areas.txt"), stopImport);
        importTimeframes(workDir.resolve("timeframes.txt"));
        Map<String, FareProduct> productsByExternalId = importFareProducts(workDir.resolve("fare_products.txt"));
        importFareLegRules(workDir.resolve("fare_leg_rules.txt"), areasByExternalId, productsByExternalId);
        importFareTransferRules(workDir.resolve("fare_transfer_rules.txt"), productsByExternalId);
        importFareLegJoinRules(workDir.resolve("fare_leg_join_rules.txt"), stopImport);
    }

    private void importFareLegJoinRules(Path joinRulesFile, StopImport stopImport) throws IOException {
        if (!Files.exists(joinRulesFile)) {
            log.info("GTFS import: fare_leg_join_rules.txt missing, skipping");
            return;
        }
        List<FareLegJoinRule> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(joinRulesFile)) {
            for (CSVRecord record : parser) {
                // Canonical (post-2024) layout: leg_group_id + leg_sequence
                // + preceding_trip_transfer_limit. Legacy MobilityData
                // layout: from/to_network/stop pairs. We accept both.
                String legGroupId = optional(record, "leg_group_id");
                Integer legSequence = parseIntOrNull(optional(record, "leg_sequence"));
                Integer precedingLimit = parseIntOrNull(
                        optional(record, "preceding_trip_transfer_limit"));

                String fromStopId = optional(record, "from_stop_id");
                String toStopId = optional(record, "to_stop_id");
                String fromNet = optional(record, "from_network_id");
                String toNet = optional(record, "to_network_id");
                Stop fromStop = isBlank(fromStopId) ? null : stopImport.stopsByGtfsId.get(fromStopId);
                Stop toStop = isBlank(toStopId) ? null : stopImport.stopsByGtfsId.get(toStopId);
                boolean canonical = !isBlank(legGroupId) || legSequence != null;
                boolean legacy = !isBlank(fromNet) || !isBlank(toNet)
                        || fromStop != null || toStop != null;
                if (!canonical && !legacy) {
                    continue;
                }
                batch.add(FareLegJoinRule.builder()
                        .legGroupId(truncate(legGroupId, 100))
                        .legSequence(legSequence)
                        .precedingTripTransferLimit(precedingLimit)
                        .fromNetworkId(truncate(fromNet, 100))
                        .toNetworkId(truncate(toNet, 100))
                        .fromStop(fromStop)
                        .toStop(toStop)
                        .build());
            }
        }
        fareLegJoinRuleRepository.saveAll(batch);
        log.info("GTFS import: {} fare leg join rules persisted", batch.size());
    }

    private void importNetworks(Path networksFile, Path routeNetworksFile,
                                Map<String, Line> linesByGtfsId) throws IOException {
        Map<String, Network> result = new HashMap<>();
        if (!Files.exists(networksFile)) {
            log.info("GTFS import: networks.txt missing, skipping");
            return;
        }
        try (CSVParser parser = openCsv(networksFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "network_id");
                if (isBlank(externalId)) {continue;}
                Network network = Network.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "network_name"), 200))
                        .build();
                result.put(externalId, network);
            }
        }
        if (result.isEmpty()) {
            return;
        }

        // Resolve route memberships before persist; the M2M join rows
        // ride along with the parent saveAll.
        if (Files.exists(routeNetworksFile)) {
            try (CSVParser parser = openCsv(routeNetworksFile)) {
                for (CSVRecord record : parser) {
                    String networkExtId = optional(record, "network_id");
                    String routeGtfsId = optional(record, "route_id");
                    Network network = result.get(networkExtId);
                    Line line = linesByGtfsId.get(routeGtfsId);
                    if (network != null && line != null) {
                        network.getRoutes().add(line);
                    }
                }
            }
        }
        networkRepository.saveAll(result.values());
        log.info("GTFS import: {} networks persisted", result.size());
    }

    private void importFareMedia(Path mediaFile) throws IOException {
        if (!Files.exists(mediaFile)) {
            log.info("GTFS import: fare_media.txt missing, skipping");
            return;
        }
        List<FareMedia> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(mediaFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "fare_media_id");
                if (isBlank(externalId)) {continue;}
                batch.add(FareMedia.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "fare_media_name"), 200))
                        .mediaType(parseShortOrNull(optional(record, "fare_media_type")))
                        .build());
            }
        }
        fareMediaRepository.saveAll(batch);
        log.info("GTFS import: {} fare media rows persisted", batch.size());
    }

    private Map<String, Area> importAreas(Path areasFile, Path stopAreasFile, StopImport stopImport)
            throws IOException {
        Map<String, Area> result = new HashMap<>();
        if (!Files.exists(areasFile)) {
            log.info("GTFS import: areas.txt missing, skipping Fares v2 areas");
            return result;
        }
        try (CSVParser parser = openCsv(areasFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "area_id");
                if (isBlank(externalId)) {continue;}
                Area area = Area.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "area_name"), 200))
                        .build();
                result.put(externalId, area);
            }
        }
        if (result.isEmpty()) {
            return result;
        }

        // Resolve stop memberships before persist so the @ManyToMany
        // join rows go in atomically with their parents.
        if (Files.exists(stopAreasFile)) {
            try (CSVParser parser = openCsv(stopAreasFile)) {
                for (CSVRecord record : parser) {
                    String areaId = optional(record, "area_id");
                    String stopGtfsId = optional(record, "stop_id");
                    Area area = result.get(areaId);
                    if (area == null || isBlank(stopGtfsId)) {continue;}
                    Stop stop = stopImport.stopsByGtfsId.get(stopGtfsId);
                    if (stop != null) {
                        area.getStops().add(stop);
                    }
                }
            }
        }
        areaRepository.saveAll(result.values());
        log.info("GTFS import: {} fares-v2 areas persisted", result.size());
        return result;
    }

    private void importTimeframes(Path timeframesFile) throws IOException {
        if (!Files.exists(timeframesFile)) {
            log.info("GTFS import: timeframes.txt missing, skipping");
            return;
        }
        List<Timeframe> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(timeframesFile)) {
            for (CSVRecord record : parser) {
                String groupId = optional(record, "timeframe_group_id");
                if (isBlank(groupId)) {continue;}
                batch.add(Timeframe.builder()
                        .timeframeGroupId(truncate(groupId, 100))
                        .startTime(GtfsParse.parseGtfsTime(optional(record, "start_time")))
                        .endTime(GtfsParse.parseGtfsTime(optional(record, "end_time")))
                        .serviceId(truncate(optional(record, "service_id"), 100))
                        .build());
            }
        }
        timeframeRepository.saveAll(batch);
        log.info("GTFS import: {} timeframe windows persisted", batch.size());
    }

    private void importRiderCategories(Path file) throws IOException {
        if (!Files.exists(file)) {
            log.info("GTFS import: rider_categories.txt missing, skipping");
            return;
        }
        List<com.transit.hub.domain.model.RiderCategory> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(file)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "rider_category_id");
                if (isBlank(externalId)) {continue;}
                batch.add(com.transit.hub.domain.model.RiderCategory.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "rider_category_name"), 200))
                        .isDefaultFareCategory(parseShortOrNull(
                                optional(record, "is_default_fare_category")))
                        .eligibilityUrl(truncate(optional(record, "eligibility_url"), 500))
                        .build());
            }
        }
        riderCategoryRepository.saveAll(batch);
        log.info("GTFS import: {} rider categories persisted", batch.size());
    }

    private Map<String, FareProduct> importFareProducts(Path productsFile) throws IOException {
        Map<String, FareProduct> result = new HashMap<>();
        if (!Files.exists(productsFile)) {
            log.info("GTFS import: fare_products.txt missing, skipping");
            return result;
        }
        try (CSVParser parser = openCsv(productsFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "fare_product_id");
                String amountRaw = optional(record, "amount");
                String currency = optional(record, "currency");
                if (isBlank(externalId) || isBlank(amountRaw) || isBlank(currency)) {continue;}
                java.math.BigDecimal amount;
                try {
                    amount = new java.math.BigDecimal(amountRaw.trim());
                } catch (NumberFormatException e) {
                    log.warn("GTFS import: fare_product {} has invalid amount '{}', skipping",
                            externalId, amountRaw);
                    continue;
                }
                FareProduct product = FareProduct.builder()
                        .externalId(truncate(externalId, 100))
                        .name(truncate(optional(record, "fare_product_name"), 200))
                        .fareMediaId(truncate(optional(record, "fare_media_id"), 100))
                        .riderCategoryId(truncate(optional(record, "rider_category_id"), 100))
                        .amount(amount)
                        .currency(truncate(currency, 3))
                        .build();
                result.put(externalId, product);
            }
        }
        fareProductRepository.saveAll(result.values());
        log.info("GTFS import: {} fare products persisted", result.size());
        return result;
    }

    private void importFareLegRules(Path legRulesFile,
                                     Map<String, Area> areasByExternalId,
                                     Map<String, FareProduct> productsByExternalId) throws IOException {
        if (!Files.exists(legRulesFile)) {
            log.info("GTFS import: fare_leg_rules.txt missing, skipping");
            return;
        }
        List<FareLegRule> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(legRulesFile)) {
            for (CSVRecord record : parser) {
                FareLegRule rule = FareLegRule.builder()
                        .legGroupId(truncate(optional(record, "leg_group_id"), 100))
                        .networkId(truncate(optional(record, "network_id"), 100))
                        .fromArea(areasByExternalId.get(optional(record, "from_area_id")))
                        .toArea(areasByExternalId.get(optional(record, "to_area_id")))
                        .fromTimeframeGroupId(truncate(optional(record, "from_timeframe_group_id"), 100))
                        .toTimeframeGroupId(truncate(optional(record, "to_timeframe_group_id"), 100))
                        .fareProduct(productsByExternalId.get(optional(record, "fare_product_id")))
                        .rulePriority(parseIntOrNull(optional(record, "rule_priority")))
                        .build();
                batch.add(rule);
            }
        }
        fareLegRuleRepository.saveAll(batch);
        log.info("GTFS import: {} fare leg rules persisted", batch.size());
    }

    private void importFareTransferRules(Path transferRulesFile,
                                          Map<String, FareProduct> productsByExternalId) throws IOException {
        if (!Files.exists(transferRulesFile)) {
            log.info("GTFS import: fare_transfer_rules.txt missing, skipping");
            return;
        }
        List<FareTransferRule> batch = new ArrayList<>();
        try (CSVParser parser = openCsv(transferRulesFile)) {
            for (CSVRecord record : parser) {
                String typeRaw = optional(record, "fare_transfer_type");
                if (isBlank(typeRaw)) {continue;}
                short transferType;
                try {
                    transferType = Short.parseShort(typeRaw.trim());
                } catch (NumberFormatException e) {
                    continue;
                }
                FareTransferRule rule = FareTransferRule.builder()
                        .fromLegGroupId(truncate(optional(record, "from_leg_group_id"), 100))
                        .toLegGroupId(truncate(optional(record, "to_leg_group_id"), 100))
                        .transferCount(parseIntOrNull(optional(record, "transfer_count")))
                        .durationLimit(parseIntOrNull(optional(record, "duration_limit")))
                        .durationLimitType(parseShortOrNull(optional(record, "duration_limit_type")))
                        .fareTransferType(transferType)
                        .fareProduct(productsByExternalId.get(optional(record, "fare_product_id")))
                        .minutesBeforeToStartBoardingTime(
                                parseIntOrNull(optional(record, "minutes_before_to_start_boarding_time")))
                        .minutesAfterToStartBoardingTime(
                                parseIntOrNull(optional(record, "minutes_after_to_start_boarding_time")))
                        .build();
                batch.add(rule);
            }
        }
        fareTransferRuleRepository.saveAll(batch);
        log.info("GTFS import: {} fare transfer rules persisted", batch.size());
    }

    /**
     * Reads {@code location_groups.txt} + {@code location_group_stops.txt}.
     * Wipes both before re-inserting; cascade on the join table picks
     * up the stop memberships when we delete the parent.
     */
    private void importLocationGroups(Path workDir, StopImport stopImport) throws IOException {
        locationGroupRepository.deleteAllInBatch();
        locationGroupRepository.flush();

        Path groupsFile = workDir.resolve("location_groups.txt");
        if (!Files.exists(groupsFile)) {
            log.info("GTFS import: location_groups.txt missing, skipping");
            return;
        }
        Map<String, LocationGroup> groupsByGtfsId = new HashMap<>();
        try (CSVParser parser = openCsv(groupsFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "location_group_id");
                if (isBlank(externalId)) {continue;}
                LocationGroup group = LocationGroup.builder()
                        .externalId(truncate(externalId.trim(), 100))
                        .groupName(truncate(optional(record, "location_group_name"), 200))
                        .build();
                groupsByGtfsId.put(externalId, locationGroupRepository.save(group));
            }
        }
        log.info("GTFS import: {} location groups persisted", groupsByGtfsId.size());

        Path membershipFile = workDir.resolve("location_group_stops.txt");
        if (!Files.exists(membershipFile)) {
            return;
        }
        int memberships = 0;
        int skipped = 0;
        try (CSVParser parser = openCsv(membershipFile)) {
            for (CSVRecord record : parser) {
                String groupId = optional(record, "location_group_id");
                String gtfsStopId = optional(record, "stop_id");
                if (isBlank(groupId) || isBlank(gtfsStopId)) {continue;}
                LocationGroup group = groupsByGtfsId.get(groupId);
                if (group == null) {
                    skipped++;
                    continue;
                }
                Stop stop = resolveStop(gtfsStopId, stopImport);
                if (stop == null) {
                    skipped++;
                    continue;
                }
                group.getStops().add(stop);
                memberships++;
            }
        }
        // Saving the parents commits the new join-table rows.
        locationGroupRepository.saveAll(groupsByGtfsId.values());
        if (skipped > 0) {
            log.warn("GTFS import: skipped {} location_group_stops rows referencing unknown group/stop",
                    skipped);
        }
        log.info("GTFS import: {} location group / stop memberships created", memberships);
    }

    /**
     * Reads GTFS-flex {@code locations.geojson}. Each top-level Feature
     * is one polygonal pickup/dropoff zone; we store the raw geometry
     * as TEXT alongside a pre-computed bounding box for fast browsing.
     * Replaces the table on every import (no downstream FK).
     *
     * <p>JTS / Hibernate Spatial intentionally avoided — see ADR 0026.
     */
    private void importLocations(Path locationsFile) throws IOException {
        locationRepository.deleteAllInBatch();
        locationRepository.flush();

        if (!Files.exists(locationsFile)) {
            log.info("GTFS import: locations.geojson missing, skipping");
            return;
        }

        com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
        com.fasterxml.jackson.databind.JsonNode root = mapper.readTree(locationsFile.toFile());
        com.fasterxml.jackson.databind.JsonNode features = root.get("features");
        if (features == null || !features.isArray() || features.isEmpty()) {
            log.info("GTFS import: locations.geojson has no features, skipping");
            return;
        }

        int persisted = 0;
        int skipped = 0;
        for (com.fasterxml.jackson.databind.JsonNode feature : features) {
            com.fasterxml.jackson.databind.JsonNode geom = feature.get("geometry");
            com.fasterxml.jackson.databind.JsonNode props = feature.get("properties");
            if (geom == null || !geom.has("type") || !geom.has("coordinates")) {
                skipped++;
                continue;
            }
            String externalId = feature.has("id") ? feature.get("id").asText() :
                    (props != null && props.has("id") ? props.get("id").asText() : null);
            if (isBlank(externalId)) {
                skipped++;
                continue;
            }
            String stopExternalId = props != null && props.has("stop_id")
                    ? props.get("stop_id").asText() : null;
            // The current GTFS-flex spec stores the human-readable name
            // under `properties.name`. Older feeds (and the original
            // Mobility-Data fixture set) used `stop_name`. Try both so
            // we work with feeds that haven't yet migrated.
            String name = null;
            if (props != null) {
                if (props.has("name") && !props.get("name").isNull()) {
                    name = props.get("name").asText();
                } else if (props.has("stop_name") && !props.get("stop_name").isNull()) {
                    name = props.get("stop_name").asText();
                }
            }
            String geomType = geom.get("type").asText();

            double[] bbox = computeBoundingBox(geom.get("coordinates"));
            Location loc = Location.builder()
                    .externalId(truncate(externalId, 100))
                    .stopExternalId(truncate(stopExternalId, 100))
                    .name(truncate(name, 200))
                    .geometryType(truncate(geomType, 30))
                    .geometryJson(mapper.writeValueAsString(geom))
                    .minLatitude(Double.isNaN(bbox[0]) ? null : bbox[0])
                    .minLongitude(Double.isNaN(bbox[1]) ? null : bbox[1])
                    .maxLatitude(Double.isNaN(bbox[2]) ? null : bbox[2])
                    .maxLongitude(Double.isNaN(bbox[3]) ? null : bbox[3])
                    .build();
            locationRepository.save(loc);
            persisted++;
        }
        if (skipped > 0) {
            log.warn("GTFS import: skipped {} locations.geojson features (missing id or geometry)", skipped);
        }
        log.info("GTFS import: {} locations.geojson features persisted", persisted);
    }

    /** Walks any GeoJSON coordinates array (Polygon, MultiPolygon, …)
     *  recursively and returns {@code [minLat, minLon, maxLat, maxLon]}.
     *  GeoJSON convention is {@code [longitude, latitude]} per coordinate
     *  pair. Returns nulls (encoded as four NaN slots collapsed to null
     *  by the entity setters) if the structure is malformed. */
    private double[] computeBoundingBox(com.fasterxml.jackson.databind.JsonNode coordinates) {
        double[] box = {Double.MAX_VALUE, Double.MAX_VALUE, -Double.MAX_VALUE, -Double.MAX_VALUE};
        walkCoordinates(coordinates, box);
        if (box[0] == Double.MAX_VALUE) {
            return new double[]{Double.NaN, Double.NaN, Double.NaN, Double.NaN};
        }
        return box;
    }

    private void walkCoordinates(com.fasterxml.jackson.databind.JsonNode node, double[] box) {
        if (node == null || !node.isArray() || node.isEmpty()) {return;}
        com.fasterxml.jackson.databind.JsonNode head = node.get(0);
        if (head != null && head.isNumber() && node.size() >= 2) {
            // Leaf coordinate pair: [lon, lat] (GeoJSON convention).
            double lon = node.get(0).asDouble();
            double lat = node.get(1).asDouble();
            box[0] = Math.min(box[0], lat);
            box[1] = Math.min(box[1], lon);
            box[2] = Math.max(box[2], lat);
            box[3] = Math.max(box[3], lon);
            return;
        }
        for (com.fasterxml.jackson.databind.JsonNode child : node) {
            walkCoordinates(child, box);
        }
    }

    /**
     * Reads {@code booking_rules.txt}. Replaces the table on every
     * import — the stop_times FKs that would reference a deleted rule
     * fall to "no booking info" rather than dangle, which is what we
     * want until a passenger surface justifies the FKs.
     */
    private Map<String, BookingRule> importBookingRules(Path bookingRulesFile) throws IOException {
        bookingRuleRepository.deleteAllInBatch();
        bookingRuleRepository.flush();

        Map<String, BookingRule> result = new HashMap<>();
        if (!Files.exists(bookingRulesFile)) {
            log.info("GTFS import: booking_rules.txt missing, skipping");
            return result;
        }
        int skippedBadType = 0;
        try (CSVParser parser = openCsv(bookingRulesFile)) {
            for (CSVRecord record : parser) {
                String externalId = optional(record, "booking_rule_id");
                if (isBlank(externalId)) {continue;}
                Integer typeCode = parseIntOrNull(optional(record, "booking_type"));
                if (typeCode == null) {
                    skippedBadType++;
                    continue;
                }
                BookingType bookingType = BookingType.fromGtfsCode(typeCode);
                if (bookingType == null) {
                    skippedBadType++;
                    continue;
                }
                LocalTime cutoff = GtfsParse.parseGtfsTime(optional(record, "prior_notice_last_time"));

                String trimmed = externalId.trim();
                BookingRule rule = BookingRule.builder()
                        .externalId(truncate(trimmed, 100))
                        .bookingType(bookingType)
                        .priorNoticeDurationMin(parseIntOrNull(optional(record, "prior_notice_duration_min")))
                        .priorNoticeDurationMax(parseIntOrNull(optional(record, "prior_notice_duration_max")))
                        .priorNoticeLastDay(parseIntOrNull(optional(record, "prior_notice_last_day")))
                        .priorNoticeLastTime(cutoff)
                        .priorNoticeStartDay(parseIntOrNull(optional(record, "prior_notice_start_day")))
                        .phone(truncate(optional(record, "phone_number"), 30))
                        .bookingUrl(truncate(optional(record, "booking_url"), 500))
                        .infoUrl(truncate(optional(record, "info_url"), 500))
                        .message(truncate(optional(record, "message"), 1000))
                        .build();
                result.put(trimmed, rule);
            }
        }
        if (!result.isEmpty()) {
            bookingRuleRepository.saveAll(result.values());
        }
        if (skippedBadType > 0) {
            log.warn("GTFS import: skipped {} booking_rules rows with invalid booking_type",
                    skippedBadType);
        }
        log.info("GTFS import: {} booking rules persisted", result.size());
        return result;
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

    /** Resolves a GTFS stop_id to its persisted Stop. Phase 1.3 keeps
     *  every platform and station as a separate row, so a direct
     *  lookup against {@code stopsByGtfsId} is enough — no
     *  parent-walk required. */
    private static Stop resolveStop(String gtfsStopId, StopImport stopImport) {
        return stopImport.stopsByGtfsId.get(gtfsStopId);
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

    /**
     * Computes the per-schedule wheelchair override. Returns null when the
     * trip's value matches the itinerary's default (the common case, so
     * the schedule row stores nothing). Returns true/false only when the
     * trip explicitly diverges.
     */
    private static Optional<Boolean> computeWheelchairOverride(int tripWheelchair,
            com.transit.hub.domain.model.enums.WheelchairAccess itineraryDefault) {
        if (tripWheelchair == 1) {
            return itineraryDefault == com.transit.hub.domain.model.enums.WheelchairAccess.ACCESSIBLE
                    ? Optional.empty() : Optional.of(Boolean.TRUE);
        }
        if (tripWheelchair == 2) {
            return itineraryDefault == com.transit.hub.domain.model.enums.WheelchairAccess.NOT_ACCESSIBLE
                    ? Optional.empty() : Optional.of(Boolean.FALSE);
        }
        return Optional.empty();
    }

    /**
     * Computes the per-schedule bikes override following the same
     * empty-means-inherit rule as {@link #computeWheelchairOverride}.
     */
    private static Optional<Boolean> computeBikesOverride(int tripBikes,
            com.transit.hub.domain.model.enums.BikesAllowed itineraryDefault) {
        if (tripBikes == 1) {
            return itineraryDefault == com.transit.hub.domain.model.enums.BikesAllowed.ALLOWED
                    ? Optional.empty() : Optional.of(Boolean.TRUE);
        }
        if (tripBikes == 2) {
            return itineraryDefault == com.transit.hub.domain.model.enums.BikesAllowed.NOT_ALLOWED
                    ? Optional.empty() : Optional.of(Boolean.FALSE);
        }
        return Optional.empty();
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
     * Majority vote on {@code cars_allowed} (post-2023 trips.txt
     * extension), mirroring {@link #majorityBikes}.
     */
    private static com.transit.hub.domain.model.enums.CarsAllowed majorityCars(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        int yes = 0;
        int no = 0;
        for (TripInfo info : tripInfos.values()) {
            if (!info.routeId.equals(key.routeId)) {continue;}
            if (!info.directionId.equals(key.directionId)) {continue;}
            if (info.carsAllowed == 1) { yes++; }
            else if (info.carsAllowed == 2) { no++; }
        }
        if (yes == 0 && no == 0) {
            return com.transit.hub.domain.model.enums.CarsAllowed.UNKNOWN;
        }
        if (yes > no) {
            return com.transit.hub.domain.model.enums.CarsAllowed.ALLOWED;
        }
        if (no > yes) {
            return com.transit.hub.domain.model.enums.CarsAllowed.NOT_ALLOWED;
        }
        return com.transit.hub.domain.model.enums.CarsAllowed.UNKNOWN;
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

    private static String buildItineraryName(String headsign, String directionId) {
        if (!isBlank(headsign)) {
            return "→ " + headsign.trim();
        }
        return "Direction " + ("0".equals(directionId) ? "0" : "1");
    }

    private static String optional(CSVRecord record, String column) {
        return record.isMapped(column) ? record.get(column) : "";
    }

    /** GTFS spec invariant: a single id namespace covers stops.stop_id,
     *  location_groups.location_group_id and locations.geojson Feature.id.
     *  A feed that reuses the same id across these three buckets makes
     *  every stop_times.txt reference ambiguous. We don't drop the
     *  conflicts (some feeds rely on the overlap as a poor man's "this
     *  flex zone covers exactly that stop") but we log them loudly so
     *  an operator can reach out to the publisher. */
    private void validateGlobalIdUniqueness() {
        Set<String> stopIds = stopRepository.findAll().stream()
                .map(Stop::getExternalId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> locationIds = locationRepository.findAll().stream()
                .map(Location::getExternalId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());
        Set<String> groupIds = locationGroupRepository.findAll().stream()
                .map(LocationGroup::getExternalId)
                .filter(java.util.Objects::nonNull)
                .collect(java.util.stream.Collectors.toSet());

        Set<String> stopVsLocation = new HashSet<>(stopIds);
        stopVsLocation.retainAll(locationIds);
        Set<String> stopVsGroup = new HashSet<>(stopIds);
        stopVsGroup.retainAll(groupIds);
        Set<String> locationVsGroup = new HashSet<>(locationIds);
        locationVsGroup.retainAll(groupIds);

        int total = stopVsLocation.size() + stopVsGroup.size() + locationVsGroup.size();
        if (total == 0) {
            return;
        }
        log.warn("GTFS import: {} id collisions across the stop / location / location_group "
                        + "namespace (stop∩location={}, stop∩group={}, location∩group={}). "
                        + "stop_times references may be ambiguous.",
                total, stopVsLocation.size(), stopVsGroup.size(), locationVsGroup.size());
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
