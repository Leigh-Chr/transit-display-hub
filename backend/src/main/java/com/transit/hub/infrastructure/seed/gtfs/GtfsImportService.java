package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.FeedInfo;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.seed.gtfs.model.FrequencyWindow;
import com.transit.hub.infrastructure.seed.gtfs.model.ItineraryImport;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import com.transit.hub.infrastructure.seed.gtfs.sections.AgencyImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.AttributionImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper;
import com.transit.hub.infrastructure.seed.gtfs.sections.FareV1Importer;
import com.transit.hub.infrastructure.seed.gtfs.sections.FareV2Importer;
import com.transit.hub.infrastructure.seed.gtfs.sections.ItineraryImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.ScheduleImporter;
import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.infrastructure.seed.gtfs.sections.BookingRuleImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.LocationImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.LocationGroupImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.PathwayImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.RouteImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.StationLevelImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.StopImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.TransferImporter;
import com.transit.hub.infrastructure.seed.gtfs.sections.TranslationImporter;
import com.transit.hub.infrastructure.persistence.LocationGroupRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.FeedInfoRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipFile;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;

/**
 * Imports a standard GTFS feed into the application's domain model.
 * Network-agnostic: works with any GTFS-compliant feed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GtfsImportService {

    private static final double SCHEMATIC_SIZE = 1000.0;
    private static final double SCHEMATIC_MARGIN = 50.0;

    /** Hard cap per zip entry — defends against a single oversized file
     *  in an otherwise small archive. 200 MB is comfortably above the
     *  largest stop_times.txt we have seen in the wild (Île-de-France
     *  STIF, ~80 MB once expanded). */
    static final long MAX_ZIP_ENTRY_BYTES = 200L * 1024 * 1024;

    /** Aggregate cap across all entries — defends against a fan-out
     *  zip-bomb whose individual entries each stay under the per-entry
     *  cap. 500 MB sits well above any real-world GTFS feed. */
    static final long MAX_ZIP_TOTAL_BYTES = 500L * 1024 * 1024;

    private final AgencyImporter agencyImporter;
    private final RouteImporter routeImporter;
    private final StopImporter stopImporter;
    private final PathwayImporter pathwayImporter;
    private final TransferImporter transferImporter;
    private final StationLevelImporter stationLevelImporter;
    private final TranslationImporter translationImporter;
    private final AttributionImporter attributionImporter;
    private final FareV1Importer fareV1Importer;
    private final FareV2Importer fareV2Importer;
    private final BookingRuleImporter bookingRuleImporter;
    private final ItineraryImporter itineraryImporter;
    private final ScheduleImporter scheduleImporter;
    private final LocationImporter locationImporter;
    private final LocationGroupImporter locationGroupImporter;

    private final StopRepository stopRepository;
    private final FeedInfoRepository feedInfoRepository;
    private final LocationGroupRepository locationGroupRepository;
    private final LocationRepository locationRepository;

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
    public ImportResult importFromZip(Path zipPath, @Nullable String sourceUrl, @Nullable String sourceHash) throws IOException {
        Path workDir = Files.createTempDirectory("gtfs-extract-");
        try {
            extractZip(zipPath, workDir);

            persistFeedInfo(workDir.resolve("feed_info.txt"), sourceUrl, sourceHash);

            Map<String, Agency> agenciesByGtfsId = agencyImporter.importAgencies(workDir.resolve("agency.txt"));
            Map<String, Line> linesByGtfsId = routeImporter.importRoutes(workDir.resolve("routes.txt"), agenciesByGtfsId);
            StopImport stopImport = stopImporter.importStops(workDir.resolve("stops.txt"));

            // Flush each upstream section so the next one's saveAll
            // doesn't bundle their pending statements into a single
            // unsortable batch. Each flush still respects order_inserts.
            entityManager.flush();

            ItineraryImport itineraryImport = itineraryImporter.importItineraries(
                    workDir.resolve("trips.txt"),
                    workDir.resolve("stop_times.txt"),
                    linesByGtfsId,
                    stopImport);
            entityManager.flush();

            Map<String, List<FrequencyWindow>> frequencies =
                    scheduleImporter.loadFrequencies(workDir.resolve("frequencies.txt"));

            // Booking rules must land before schedules so each Schedule can
            // resolve its pickup_booking_rule_id / drop_off_booking_rule_id
            // FK during import. The rules table is small, so loading it
            // upfront has no measurable cost.
            Map<String, BookingRule> bookingRules =
                    bookingRuleImporter.importBookingRules(workDir.resolve("booking_rules.txt"));

            // Locations + location groups must land before schedules so the
            // flex_stop_times rows materialised inside importSchedules can
            // resolve their location_id / location_group_id FKs in a single
            // pass.
            locationImporter.importLocations(workDir.resolve("locations.geojson"));
            locationGroupImporter.importLocationGroups(workDir, stopImport);

            int schedules = scheduleImporter.importSchedules(workDir, itineraryImport, stopImport,
                    frequencies, bookingRules);

            transferImporter.importTransfers(workDir.resolve("transfers.txt"), stopImport);

            stationLevelImporter.importStationLevels(workDir.resolve("levels.txt"));

            pathwayImporter.importPathways(workDir.resolve("pathways.txt"), stopImport);

            translationImporter.importTranslations(workDir.resolve("translations.txt"));

            fareV1Importer.importFares(workDir, linesByGtfsId, agenciesByGtfsId);

            fareV2Importer.importFaresV2(workDir, stopImport, linesByGtfsId);

            attributionImporter.importAttributions(workDir.resolve("attributions.txt"));

            assignSchematicCoordinates(stopImport.stopsByGtfsId().values());

            validateGlobalIdUniqueness();

            return new ImportResult(
                    linesByGtfsId.size(),
                    stopImport.stopsByGtfsId().size(),
                    itineraryImport.itineraryCount(),
                    itineraryImport.itineraryStopCount(),
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
    private void persistFeedInfo(Path feedInfoFile, @Nullable String sourceUrl, @Nullable String sourceHash) throws IOException {
        FeedInfo.FeedInfoBuilder builder = FeedInfo.builder()
                .sourceUrl(sourceUrl)
                .sourceHash(sourceHash)
                .importedAt(java.time.Instant.now());

        if (Files.exists(feedInfoFile)) {
            try (CSVParser parser = CsvHelper.openCsv(feedInfoFile)) {
                for (CSVRecord record : parser) {
                    builder
                            .publisherName(truncate(CsvHelper.optional(record, "feed_publisher_name"), 200))
                            .publisherUrl(truncate(CsvHelper.optional(record, "feed_publisher_url"), 500))
                            .lang(truncate(CsvHelper.optional(record, "feed_lang"), 20))
                            .defaultLang(truncate(CsvHelper.optional(record, "default_lang"), 20))
                            .feedVersion(truncate(CsvHelper.optional(record, "feed_version"), 50))
                            .contactEmail(truncate(CsvHelper.optional(record, "feed_contact_email"), 50))
                            .contactUrl(truncate(CsvHelper.optional(record, "feed_contact_url"), 500))
                            .startDate(GtfsParse.parseGtfsDate(CsvHelper.optional(record, "feed_start_date")))
                            .endDate(GtfsParse.parseGtfsDate(CsvHelper.optional(record, "feed_end_date")));
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
        extractZip(zipPath, target, MAX_ZIP_ENTRY_BYTES, MAX_ZIP_TOTAL_BYTES);
    }

    /**
     * Extract {@code zipPath} into {@code target}, defending against
     * zip-slip (paths that escape the target) and zip-bombs (individual
     * entries above {@code maxEntryBytes} or aggregate output above
     * {@code maxTotalBytes}). The decompressed bytes are counted during
     * the copy itself rather than trusting {@code ZipEntry.getSize()},
     * which a maliciously crafted archive can under-report or omit
     * altogether (returns -1 for stream-mode entries).
     */
    static void extractZip(Path zipPath, Path target, long maxEntryBytes, long maxTotalBytes) throws IOException {
        long[] totalBytes = {0L};
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
                    long written = copyWithCap(in, out, maxEntryBytes, entry.getName());
                    totalBytes[0] += written;
                    if (totalBytes[0] > maxTotalBytes) {
                        throw new IllegalStateException("Zip archive exceeds total cap of "
                                + maxTotalBytes + " bytes (decompressed so far: " + totalBytes[0] + ")");
                    }
                } catch (IOException e) {
                    throw new IllegalStateException("Failed to extract " + entry.getName(), e);
                }
            });
        }
    }

    /** Stream {@code in} into {@code out} aborting if more than
     *  {@code maxBytes} are produced for the single entry {@code name}. */
    private static long copyWithCap(InputStream in, Path out, long maxBytes, String name) throws IOException {
        long copied = 0L;
        byte[] buf = new byte[8192];
        try (OutputStream os = Files.newOutputStream(out,
                StandardOpenOption.CREATE,
                StandardOpenOption.TRUNCATE_EXISTING)) {
            int n;
            while ((n = in.read(buf)) > 0) {
                copied += n;
                if (copied > maxBytes) {
                    throw new IllegalStateException("Zip entry exceeds " + maxBytes
                            + " bytes (decompressed so far: " + copied + "): " + name);
                }
                os.write(buf, 0, n);
            }
        }
        return copied;
    }

    private void assignSchematicCoordinates(java.util.Collection<Stop> stops) {
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
        java.util.List<Stop> dirty = new java.util.ArrayList<>(stops.size());
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

    /** GTFS spec invariant: a single id namespace covers stops.stop_id,
     *  location_groups.location_group_id and locations.geojson Feature.id.
     *  A feed that reuses the same id across these three buckets makes
     *  every stop_times.txt reference ambiguous. We don't drop the
     *  conflicts (some feeds rely on the overlap as a poor man's "this
     *  flex zone covers exactly that stop") but we log them loudly so
     *  an operator can reach out to the publisher. */
    private void validateGlobalIdUniqueness() {
        // JPQL projections instead of findAll() — on a 50k-stop feed the previous
        // version hydrated every Stop / Location / LocationGroup entity (plus
        // their eager associations) just to read a single string per row.
        Set<String> stopIds = new HashSet<>(stopRepository.findAllExternalIds());
        Set<String> locationIds = new HashSet<>(locationRepository.findAllExternalIds());
        Set<String> groupIds = new HashSet<>(locationGroupRepository.findAllExternalIds());

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
