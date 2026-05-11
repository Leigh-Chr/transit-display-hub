package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Shape;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsParse;
import com.transit.hub.infrastructure.seed.gtfs.model.ItineraryImport;
import com.transit.hub.infrastructure.seed.gtfs.model.RouteDirKey;
import com.transit.hub.infrastructure.seed.gtfs.model.TripInfo;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.firstNonBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDirectionId;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code trips.txt} and {@code stop_times.txt} (two passes) to build
 * the {@link Itinerary} + {@link ItineraryStop} rows. For each (route_id,
 * direction_id) pair the representative trip is the one with the most stops
 * (longest variant covers the full itinerary). Returns an {@link ItineraryImport}
 * struct that {@link ScheduleImporter} uses to resolve trip → itinerary and
 * trip → service_id references without an extra DB round-trip.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ItineraryImporter {

    private static final int LINE_NAME_MAX_LENGTH = 100;

    private final ItineraryRepository itineraryRepository;
    private final StopRepository stopRepository;

    /**
     * Imports itineraries from {@code trips.txt} + {@code stop_times.txt}.
     *
     * @param tripsFile      path to {@code trips.txt}
     * @param stopTimesFile  path to {@code stop_times.txt}
     * @param linesByGtfsId  already-imported lines keyed by GTFS {@code route_id}
     * @param stopImport     pre-loaded stop lookup from {@link StopImporter}
     * @param shapesByGtfsId already-imported shapes keyed by GTFS {@code shape_id}
     * @return import result carrying counts and the in-memory indexes needed by the schedule step
     */
    public ItineraryImport importItineraries(
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
            if (!linesByGtfsId.containsKey(info.routeId())) {
                continue;
            }
            int count = stopsPerTrip.getOrDefault(tripId, 0);
            if (count == 0) {
                continue;
            }
            RouteDirKey key = new RouteDirKey(info.routeId(), info.directionId());
            if (count > bestCount.getOrDefault(key, 0)) {
                bestCount.put(key, count);
                bestTrip.put(key, tripId);
            }
        }
        Set<String> selectedTripIds = new HashSet<>(bestTrip.values());
        log.info("GTFS import: {} representative trips selected", selectedTripIds.size());

        // 4. Pass 2 over stop_times: collect (tripId -> ordered list of stops with per-stop headsign)
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
        for (Stop stop : stopImport.stopsByGtfsId().values()) {
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
            Line line = linesByGtfsId.get(key.routeId());
            TripInfo info = tripInfos.get(tripId);
            List<TimedStop> trip = stopsByTrip.get(tripId);
            if (trip == null || trip.isEmpty()) {
                continue;
            }
            trip.sort((a, b) -> Integer.compare(a.sequence(), b.sequence()));

            String itineraryName = buildItineraryName(info.headsign(), key.directionId());
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
            Shape shape = (info.shapeId() == null) ? null : shapesByGtfsId.get(info.shapeId());

            Short directionId = parseDirectionId(key.directionId());
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
                        .safeDurationFactor(info.safeDurationFactor())
                        .safeDurationOffset(info.safeDurationOffset())
                        .meanDurationFactor(info.meanDurationFactor())
                        .meanDurationOffset(info.meanDurationOffset())
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
                itinerary.setSafeDurationFactor(info.safeDurationFactor());
                itinerary.setSafeDurationOffset(info.safeDurationOffset());
                itinerary.setMeanDurationFactor(info.meanDurationFactor());
                itinerary.setMeanDurationOffset(info.meanDurationOffset());
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
                Stop stop = stopImport.stopsByGtfsId().get(ts.stopId());
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
                        .stopHeadsign(truncate(ts.headsign(), 100))
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

    // ---------- majority-vote helpers ----------

    /**
     * Picks the dominant {@code wheelchair_accessible} value among the trips
     * of a given (route, direction). Counts {@code 1} (accessible) vs
     * {@code 2} (not accessible); ignores {@code 0} (unknown). Falls back
     * to {@code UNKNOWN} when every trip is unspecified or evenly split.
     */
    public static com.transit.hub.domain.model.enums.WheelchairAccess majorityWheelchair(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        int yes = 0;
        int no = 0;
        for (TripInfo info : tripInfos.values()) {
            if (!info.routeId().equals(key.routeId())) { continue; }
            if (!info.directionId().equals(key.directionId())) { continue; }
            if (info.wheelchairAccessible() == 1) { yes++; }
            else if (info.wheelchairAccessible() == 2) { no++; }
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

    /** Majority vote on {@code bikes_allowed}, mirroring {@link #majorityWheelchair}. */
    public static com.transit.hub.domain.model.enums.BikesAllowed majorityBikes(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        int yes = 0;
        int no = 0;
        for (TripInfo info : tripInfos.values()) {
            if (!info.routeId().equals(key.routeId())) { continue; }
            if (!info.directionId().equals(key.directionId())) { continue; }
            if (info.bikesAllowed() == 1) { yes++; }
            else if (info.bikesAllowed() == 2) { no++; }
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
     * Majority vote on {@code cars_allowed} (post-2023 trips.txt extension),
     * mirroring {@link #majorityBikes}.
     */
    public static com.transit.hub.domain.model.enums.CarsAllowed majorityCars(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        int yes = 0;
        int no = 0;
        for (TripInfo info : tripInfos.values()) {
            if (!info.routeId().equals(key.routeId())) { continue; }
            if (!info.directionId().equals(key.directionId())) { continue; }
            if (info.carsAllowed() == 1) { yes++; }
            else if (info.carsAllowed() == 2) { no++; }
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
     * Computes the per-schedule wheelchair override. Returns empty when the
     * trip's value matches the itinerary's default (the common case, so the
     * schedule row stores nothing).
     */
    public static Optional<Boolean> computeWheelchairOverride(int tripWheelchair,
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
    public static Optional<Boolean> computeBikesOverride(int tripBikes,
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

    // ---------- name builder ----------

    static String buildItineraryName(String headsign, String directionId) {
        if (!isBlank(headsign)) {
            return "→ " + headsign.trim();
        }
        return "Direction " + ("0".equals(directionId) ? "0" : "1");
    }
}
