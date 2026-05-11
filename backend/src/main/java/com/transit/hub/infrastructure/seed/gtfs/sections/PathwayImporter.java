package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.PathwayMode;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code pathways.txt} and replaces the {@link Pathway} table on every
 * import. Endpoints are resolved through the stop index built by
 * {@link StopImporter}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class PathwayImporter {

    private final PathwayRepository pathwayRepository;

    /**
     * Wipes pathways and re-imports from {@code pathways.txt}.
     * The file is GTFS-optional; absent file is silently skipped.
     *
     * @param pathwaysFile path to pathways.txt inside the extracted zip
     * @param stopImport   stop index built by {@link StopImporter}
     */
    public void importPathways(Path pathwaysFile, StopImport stopImport) throws IOException {
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
                if (isBlank(externalId)) { continue; }
                String fromGtfs = optional(record, "from_stop_id");
                String toGtfs = optional(record, "to_stop_id");
                if (isBlank(fromGtfs) || isBlank(toGtfs)) { continue; }

                Stop fromStop = stopImport.stopsByGtfsId().get(fromGtfs);
                Stop toStop = stopImport.stopsByGtfsId().get(toGtfs);
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
}
