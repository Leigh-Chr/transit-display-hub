package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.LocationGroup;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.LocationGroupRepository;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads GTFS-flex {@code location_groups.txt} and {@code location_group_stops.txt},
 * replacing the {@link LocationGroup} table on every import.
 * Both files are optional; absent files are silently skipped.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class LocationGroupImporter {

    private final LocationGroupRepository locationGroupRepository;

    /**
     * Wipes the location_groups table and re-imports from
     * {@code location_groups.txt} + {@code location_group_stops.txt}.
     *
     * @param workDir   directory containing the GTFS files
     * @param stopImport pre-loaded stop lookup built by {@link StopImporter}
     */
    public void importLocationGroups(Path workDir, StopImport stopImport) throws IOException {
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
                if (isBlank(externalId)) { continue; }
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
                if (isBlank(groupId) || isBlank(gtfsStopId)) { continue; }
                LocationGroup group = groupsByGtfsId.get(groupId);
                if (group == null) {
                    skipped++;
                    continue;
                }
                Stop stop = stopImport.stopsByGtfsId().get(gtfsStopId);
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
}
