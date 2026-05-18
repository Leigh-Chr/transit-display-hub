package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseShortOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsImportSupport.externalIdIndex;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code stops.txt} and upserts {@link Stop} rows, using two-pass
 * persistence so parent stations land before their platform children.
 * Stops removed from the feed are soft-deleted (flagged disabled) to
 * preserve Device → Stop FK references in the field.
 *
 * <p>Returns a {@link StopImport} index used by downstream importers
 * (schedules, pathways, transfers, location groups, fare leg join rules).
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class StopImporter {

    private static final int STOP_NAME_MAX_LENGTH = 100;

    private final StopRepository stopRepository;

    /** Flush entity manager between passes so FK ordering is respected. */
    @PersistenceContext
    private EntityManager entityManager;

    /**
     * Reads {@code stops.txt} and upserts Stop rows using a two-pass
     * strategy: parent stations first (pass 1), then platforms (pass 2).
     * Location type 2+ (entrances, generic nodes, boarding areas) are
     * skipped as none are referenced by stop_times.
     *
     * @return index of persisted stops keyed by GTFS stop_id
     */
    public StopImport importStops(Path stopsFile) throws IOException {
        record RawStop(String id, @Nullable String name, @Nullable Double lat, @Nullable Double lon, @Nullable String parent, int locationType,
                       @Nullable String shortCode, @Nullable String ttsName, @Nullable String timezone, @Nullable String description, @Nullable String url,
                       int wheelchairBoarding, @Nullable String platformCode, @Nullable String zoneId,
                       @Nullable Short stopAccess) {}

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
        Map<String, Stop> existingByExternalId = externalIdIndex(stopRepository, Stop::getExternalId);

        // Two-pass persistence: parent stations first (so children can
        // reference them via parentStop FK), then platforms.
        Map<String, Stop> result = new LinkedHashMap<>();
        Set<UUID> seenIds = new HashSet<>();
        java.util.function.BiConsumer<RawStop, Stop> persist = (r, parent) -> {
            if (isBlank(r.name)) { return; }
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
            if (r.locationType == 1) { persist.accept(r, null); }
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
        // than delete so Devices keep their stop_id FK valid.
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
}
