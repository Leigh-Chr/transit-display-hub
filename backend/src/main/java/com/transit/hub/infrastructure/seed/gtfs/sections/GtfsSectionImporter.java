package com.transit.hub.infrastructure.seed.gtfs.sections;

import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.slf4j.Logger;
import org.springframework.data.jpa.repository.JpaRepository;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;

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
 * <p>Multi-pass importers (Schedule, Itinerary, FareV2, Route, Stop)
 * keep their bespoke flows: they need cross-row state, multi-table
 * upserts, or row-skipping policies the template would obscure
 * rather than help.
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
}
