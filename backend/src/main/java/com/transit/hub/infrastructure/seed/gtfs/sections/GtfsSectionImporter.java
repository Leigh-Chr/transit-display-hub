package com.transit.hub.infrastructure.seed.gtfs.sections;

import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.springframework.data.jpa.repository.JpaRepository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.BiFunction;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Template helper for the GTFS "section" importers that follow the
 * canonical wipe-then-rebuild pattern: drop the existing rows, flush,
 * parse the optional CSV file row-by-row through a mapper, batch-save
 * the parsed entities, log the count.
 *
 * <p>Previously each of the dozen section importers
 * ({@code TransferImporter}, {@code AttributionImporter},
 * {@code StationLevelImporter}, etc.) reimplemented this skeleton —
 * audit P1 B-2 measured ~70 duplicated lines × 14 importers = ~1 000
 * structurally identical lines. Routing them through this helper
 * leaves only the row-to-entity mapping in each importer, where the
 * GTFS-specific knowledge actually lives.
 *
 * <h3>Importers that DO go through this helper (7)</h3>
 * <ul>
 *   <li>{@code AttributionImporter} ({@link #run})</li>
 *   <li>{@code StationLevelImporter} ({@link #run})</li>
 *   <li>{@code TransferImporter} ({@link #runWithStats}, skips unknown
 *       stops)</li>
 *   <li>{@code PathwayImporter} ({@link #runWithStats}, skips unknown
 *       stops + invalid modes)</li>
 *   <li>{@code TranslationImporter} ({@link #runWithStats}, skips
 *       duplicates)</li>
 *   <li>{@code BookingRuleImporter} ({@link #runWithStats}, skips
 *       invalid {@code booking_type})</li>
 * </ul>
 *
 * <h3>Importers that intentionally stay bespoke (7)</h3>
 * <ul>
 *   <li>{@code AgencyImporter} — <em>upsert</em>, not wipe-rebuild
 *       (ADR 0013: preserve UUIDs so foreign-key references from
 *       lines/messages stay valid across re-imports).</li>
 *   <li>{@code FareV1Importer} — <em>multi-file</em>
 *       ({@code fare_attributes.txt} + {@code fare_rules.txt}) with
 *       cross-file FK resolution.</li>
 *   <li>{@code FareV2Importer} — <em>5 dependent files</em>
 *       ({@code fare_media}, {@code fare_products}, {@code fare_leg_rules},
 *       {@code fare_transfer_rules}, {@code areas}) read in
 *       dependency order with shared lookup maps.</li>
 *   <li>{@code LocationGroupImporter} — <em>multi-file</em>
 *       ({@code location_groups.txt} + {@code location_group_stops.txt})
 *       where the second file mutates the entities persisted by the
 *       first.</li>
 *   <li>{@code LocationImporter} — parses
 *       {@code locations.geojson} (not CSV) and re-uses the booking
 *       rule index built by {@code BookingRuleImporter}.</li>
 *   <li>{@code RouteImporter} — multi-pass that also feeds the
 *       network / agency / line indices downstream importers depend
 *       on, plus FK-bound deletions.</li>
 *   <li>{@code ItineraryImporter} / {@code ScheduleImporter} /
 *       {@code StopImporter} / {@code ServiceCalendarLoader} —
 *       cross-row state (group-by-trip, sequence ordering, calendar
 *       exception application) the template would obscure rather
 *       than help.</li>
 * </ul>
 *
 * <p>Refactoring this last group to plug into the helper would require
 * variants for upsert + multi-file + multi-pass + aggregating each
 * (4 separate helpers), which exceeds the deduplication budget — each
 * importer is read end-to-end and the bespoke code is the clearest
 * way to express its specific contract.
 */
public final class GtfsSectionImporter {

    private GtfsSectionImporter() {
        // Static helper only — no instances.
    }

    /**
     * Run the wipe-then-rebuild template against {@code file}, parsing
     * each row through {@code mapper}. Returns the number of entities
     * persisted (zero when the file is missing or every row is
     * filtered out).
     *
     * @param repository JPA repository to wipe + reuse for the batch save
     * @param file CSV file path; missing files are silently skipped (the
     *             GTFS spec treats most of these files as optional)
     * @param label human-readable name for the log lines, typically the
     *              GTFS file name ("levels.txt") so an operator can
     *              correlate the count with the source
     * @param mapper row-to-entity conversion; return {@link Optional#empty()}
     *               to skip the row (validation failure, blank required column)
     * @param log    the importer's own SLF4J logger so the "GTFS import:" line
     *               carries the right class name in the log
     */
    public static <T> int run(
            JpaRepository<T, ?> repository,
            Path file,
            String label,
            Function<CSVRecord, Optional<T>> mapper,
            Logger log
    ) throws IOException {
        repository.deleteAllInBatch();
        repository.flush();

        if (!Files.exists(file)) {
            log.info("GTFS import: {} missing, skipping", label);
            return 0;
        }

        List<T> batch = new ArrayList<>();
        try (CSVParser parser = CsvHelper.openCsv(file)) {
            for (CSVRecord record : parser) {
                mapper.apply(record).ifPresent(batch::add);
            }
        }
        if (!batch.isEmpty()) {
            repository.saveAll(batch);
        }
        log.info("GTFS import: {} {} created", batch.size(), label);
        return batch.size();
    }

    /**
     * Variant of {@link #run} for importers that need to surface row-skip
     * reasons (unknown stop reference, duplicate id, bad enum…). The mapper
     * receives a {@link SkipTracker} it can call {@code skip.skip("unknown stop")}
     * on; the helper aggregates the counts per reason and appends them to the
     * final log line so operators see e.g.
     * <pre>GTFS import: 42 transfers created (3 skipped — unknown stop)</pre>
     * The {@link ImportStats} return value carries the same breakdown for
     * callers that want to assert on it in tests.
     */
    public static <T> ImportStats runWithStats(
            JpaRepository<T, ?> repository,
            Path file,
            String label,
            BiFunction<CSVRecord, SkipTracker, Optional<T>> mapper,
            Logger log
    ) throws IOException {
        repository.deleteAllInBatch();
        repository.flush();

        if (!Files.exists(file)) {
            log.info("GTFS import: {} missing, skipping", label);
            return new ImportStats(0, Map.of());
        }

        List<T> batch = new ArrayList<>();
        SkipTracker tracker = new SkipTracker();
        try (CSVParser parser = CsvHelper.openCsv(file)) {
            for (CSVRecord record : parser) {
                mapper.apply(record, tracker).ifPresent(batch::add);
            }
        }
        if (!batch.isEmpty()) {
            repository.saveAll(batch);
        }
        Map<String, Long> skipped = tracker.frozenCounts();
        if (skipped.isEmpty()) {
            log.info("GTFS import: {} {} created", batch.size(), label);
        } else {
            String summary = skipped.entrySet().stream()
                    .map(e -> e.getValue() + " skipped — " + e.getKey())
                    .collect(Collectors.joining(", "));
            log.info("GTFS import: {} {} created ({})", batch.size(), label, summary);
        }
        return new ImportStats(batch.size(), skipped);
    }

    /**
     * Result tuple for {@link #runWithStats}. {@code persisted} is the
     * number of rows that survived mapping and were saved; {@code skipped}
     * is a per-reason histogram (insertion order preserved so the log line
     * stays stable across builds).
     */
    public record ImportStats(int persisted, Map<String, Long> skipped) {}

    /**
     * Hands the mapper a simple way to record why a row was rejected. The
     * tracker is not thread-safe — importers run single-threaded on the
     * seed path, and going concurrent would defeat the deterministic log
     * order operators rely on.
     */
    public static final class SkipTracker {
        private final Map<String, Long> counts = new LinkedHashMap<>();

        public void skip(String reason) {
            counts.merge(reason, 1L, Long::sum);
        }

        Map<String, Long> frozenCounts() {
            return Map.copyOf(counts);
        }
    }

}
