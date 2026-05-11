package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.Transfer;
import com.transit.hub.infrastructure.persistence.TransferRepository;
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
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code transfers.txt} and persists {@link Transfer} rows.
 * Endpoints are resolved through the stop index built by {@link StopImporter}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TransferImporter {

    private final TransferRepository transferRepository;

    /**
     * Reads {@code transfers.txt} when present (the file is GTFS-optional).
     * Resolves both endpoints through the persisted stop index.
     *
     * @param transfersFile path to transfers.txt inside the extracted zip
     * @param stopImport    stop index built by {@link StopImporter}
     */
    public void importTransfers(Path transfersFile, StopImport stopImport) throws IOException {
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
                if (isBlank(fromGtfs) || isBlank(toGtfs)) { continue; }

                Stop fromStop = stopImport.stopsByGtfsId().get(fromGtfs);
                Stop toStop = stopImport.stopsByGtfsId().get(toGtfs);
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
}
