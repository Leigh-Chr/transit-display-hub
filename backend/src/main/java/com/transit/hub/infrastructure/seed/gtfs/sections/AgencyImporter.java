package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.infrastructure.persistence.AgencyRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseShortOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsImportSupport.externalIdIndex;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code agency.txt} and upserts {@link Agency} rows.
 * Returns a {@code Map<gtfsAgencyId, Agency>} (keyed by the raw GTFS
 * agency_id, falling back to the empty string for single-agency feeds).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class AgencyImporter {

    private final AgencyRepository agencyRepository;

    /**
     * Reads {@code agency.txt} when present. The file is GTFS-required when
     * the feed declares more than one agency but technically optional in
     * single-agency feeds. Always makes sure at least one row exists so
     * timezone resolution can rely on a non-null reference.
     *
     * @return agencies indexed by GTFS agency_id (empty-string key for feeds
     *         with no agency_id column)
     */
    public Map<String, Agency> importAgencies(Path agenciesFile) throws IOException {
        // Index pre-existing agencies by external_id so a re-import keeps
        // the same UUID — Lines reference it via FK and we don't want to
        // bounce that reference on every refresh. See ADR 0013.
        Map<String, Agency> existingByExternalId = externalIdIndex(agencyRepository, Agency::getExternalId);

        Map<String, Agency> result = new LinkedHashMap<>();
        Set<UUID> seenIds = new HashSet<>();
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
                String externalId = isBlank(agencyId) ? null : truncate(agencyId.trim(), 100);

                Agency agency = (externalId != null && existingByExternalId.containsKey(externalId))
                        ? existingByExternalId.get(externalId)
                        : new Agency();
                agency.setExternalId(externalId);
                agency.setName(name);
                agency.setUrl(truncate(optional(record, "agency_url"), 500));
                agency.setTimezone(truncate(optional(record, "agency_timezone"), 60));
                agency.setLang(truncate(optional(record, "agency_lang"), 10));
                agency.setPhone(truncate(optional(record, "agency_phone"), 30));
                agency.setFareUrl(truncate(optional(record, "agency_fare_url"), 500));
                agency.setEmail(truncate(optional(record, "agency_email"), 100));
                agency.setCemvSupport(parseShortOrNull(optional(record, "cemv_support")));

                Agency saved = agencyRepository.save(agency);
                seenIds.add(saved.getId());
                // Index both by the GTFS agency_id (when present) and by the
                // empty string so single-agency feeds can resolve to it.
                result.put(isBlank(agencyId) ? "" : agencyId, saved);
            }
        }
        // Drop agencies the new feed no longer declares. Lines that used
        // to reference them have been or will be re-bound by importRoutes.
        int orphans = 0;
        for (Agency old : existingByExternalId.values()) {
            if (!seenIds.contains(old.getId())) {
                agencyRepository.delete(old);
                orphans++;
            }
        }
        log.info("GTFS import: {} agencies upserted ({} orphans removed)", result.size(), orphans);
        return result;
    }
}
