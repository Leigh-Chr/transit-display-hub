package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.StationLevel;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
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
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code levels.txt} and replaces the {@link StationLevel} table on
 * every import. Pathways reference levels via FK; if a level is dropped,
 * the pathway admin endpoint handles the null check.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StationLevelImporter {

    private final StationLevelRepository stationLevelRepository;

    /**
     * Wipes the station level table and re-imports from {@code levels.txt}.
     * The file is GTFS-optional; absent file is silently skipped.
     */
    public void importStationLevels(Path levelsFile) throws IOException {
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
                if (isBlank(externalId)) { continue; }
                Double levelIndex = parseDoubleOrNull(optional(record, "level_index"));
                if (levelIndex == null) { continue; }
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
}
