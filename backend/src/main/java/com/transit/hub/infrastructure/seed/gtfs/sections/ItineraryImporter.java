package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Shape;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.BikesAllowed;
import com.transit.hub.domain.model.enums.CarsAllowed;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsLimits;
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
import java.util.function.ToIntFunction;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.firstNonBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDirectionId;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code trips.txt} and {@code stop_times.txt} (single pass) to build
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
    /** Compact stop reference threaded through the import — captured as
     *  package-private so the per-trip builder can stash entries. */
    private record TimedStop(String stopId, int sequence, String headsign) {}

    public ItineraryImport importItineraries(
            Path tripsFile,
            Path stopTimesFile,
            Map<String, Line> linesByGtfsId,
            StopImport stopImport,
            Map<String, Shape> shapesByGtfsId) throws IOException {

        Map<String, TripInfo> tripInfos = loadTripInfos(tripsFile);
        log.info("GTFS import: {} trips loaded", tripInfos.size());

        StopTimeBuckets buckets = loadStopTimes(stopTimesFile, tripInfos, linesByGtfsId);
        Map<RouteDirKey, String> bestTrip = pickRepresentativeTrips(buckets, tripInfos);
        // Drop the rows belonging to non-representative trips now that
        // we know which trip wins each (route, direction) — keeps the
        // big collection small for the rest of the method.
        Set<String> selectedTripIds = new HashSet<>(bestTrip.values());
        buckets.stopsByTrip.keySet().retainAll(selectedTripIds);
        log.info("GTFS import: {} representative trips selected", selectedTripIds.size());

        // Pre-load existing itineraries by external_id so re-imports
        // refresh a stable UUID. See ADR 0013.
        Map<String, Itinerary> existingItinerariesByExternalId = itineraryRepository.findAll().stream()
                .filter(i -> i.getExternalId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        Itinerary::getExternalId, java.util.function.Function.identity(),
                        (a, b) -> a));

        // Clear stop ↔ line membership before rebuilding so a route
        // reassigning its stops doesn't leave the previous lines
        // permanently attached.
        for (Stop stop : stopImport.stopsByGtfsId().values()) {
            stop.clearLines();
        }

        ItineraryBuildResult result = buildItineraries(bestTrip, tripInfos, buckets.stopsByTrip,
                linesByGtfsId, stopImport, shapesByGtfsId, existingItinerariesByExternalId);

        stopRepository.saveAll(result.stopsTouched);
        int orphans = removeOrphanedItineraries(existingItinerariesByExternalId, result.seenItineraryIds);
        if (orphans > 0) {
            log.info("GTFS import: {} obsolete itineraries removed", orphans);
        }
        log.info("GTFS import: {} itineraries upserted / {} itinerary stops created",
                result.itineraryCount, result.itineraryStopCount);
        return new ItineraryImport(result.itineraryCount, result.itineraryStopCount,
                tripInfos, result.itinerariesByRouteDir);
    }

    private Map<String, TripInfo> loadTripInfos(Path tripsFile) throws IOException {
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
        return tripInfos;
    }

    private record StopTimeBuckets(Map<String, Integer> stopsPerTrip,
                                   Map<String, List<TimedStop>> stopsByTrip) {}

    /** Single pass over stop_times.txt that produces both the per-trip
     *  count and the timed-stops list, filtered to trips attached to a
     *  known route so the in-memory footprint tracks the active network. */
    private StopTimeBuckets loadStopTimes(Path stopTimesFile, Map<String, TripInfo> tripInfos,
                                          Map<String, Line> linesByGtfsId) throws IOException {
        Map<String, Integer> stopsPerTrip = new HashMap<>();
        Map<String, List<TimedStop>> stopsByTrip = new HashMap<>();
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                TripInfo info = tripInfos.get(tripId);
                if (info == null || !linesByGtfsId.containsKey(info.routeId())) {
                    continue;
                }
                stopsPerTrip.merge(tripId, 1, Integer::sum);
                int sequence = parseInt(record.get("stop_sequence"), 0);
                String stopId = record.get("stop_id");
                String headsign = optional(record, "stop_headsign");
                stopsByTrip.computeIfAbsent(tripId, k -> new ArrayList<>())
                        .add(new TimedStop(stopId, sequence, isBlank(headsign) ? null : headsign.trim()));
            }
        }
        return new StopTimeBuckets(stopsPerTrip, stopsByTrip);
    }

    /** Picks, for each (route_id, direction_id), the trip with the most
     *  stops — the longest variant covers the full itinerary. */
    private Map<RouteDirKey, String> pickRepresentativeTrips(StopTimeBuckets buckets,
                                                             Map<String, TripInfo> tripInfos) {
        Map<RouteDirKey, String> bestTrip = new HashMap<>();
        Map<RouteDirKey, Integer> bestCount = new HashMap<>();
        for (Map.Entry<String, Integer> entry : buckets.stopsPerTrip.entrySet()) {
            String tripId = entry.getKey();
            TripInfo info = tripInfos.get(tripId);
            int count = entry.getValue();
            RouteDirKey key = new RouteDirKey(info.routeId(), info.directionId());
            if (count > bestCount.getOrDefault(key, 0)) {
                bestCount.put(key, count);
                bestTrip.put(key, tripId);
            }
        }
        return bestTrip;
    }

    private static final class ItineraryBuildResult {
        int itineraryCount;
        int itineraryStopCount;
        final Set<Stop> stopsTouched = new HashSet<>();
        final Map<RouteDirKey, Itinerary> itinerariesByRouteDir = new HashMap<>();
        final Set<UUID> seenItineraryIds = new HashSet<>();
    }

    private ItineraryBuildResult buildItineraries(
            Map<RouteDirKey, String> bestTrip,
            Map<String, TripInfo> tripInfos,
            Map<String, List<TimedStop>> stopsByTrip,
            Map<String, Line> linesByGtfsId,
            StopImport stopImport,
            Map<String, Shape> shapesByGtfsId,
            Map<String, Itinerary> existingItinerariesByExternalId) {
        ItineraryBuildResult result = new ItineraryBuildResult();
        for (Map.Entry<RouteDirKey, String> entry : bestTrip.entrySet()) {
            RouteDirKey key = entry.getKey();
            String tripId = entry.getValue();
            List<TimedStop> trip = stopsByTrip.get(tripId);
            if (trip == null || trip.isEmpty()) {
                continue;
            }
            trip.sort((a, b) -> Integer.compare(a.sequence(), b.sequence()));
            Itinerary itinerary = upsertItinerary(key, tripId, tripInfos, linesByGtfsId,
                    shapesByGtfsId, existingItinerariesByExternalId);
            attachStops(itinerary, trip, stopImport, linesByGtfsId.get(key.routeId()), result);
            itineraryRepository.save(itinerary);
            result.itinerariesByRouteDir.put(key, itinerary);
            result.seenItineraryIds.add(itinerary.getId());
            result.itineraryCount++;
        }
        return result;
    }

    private Itinerary upsertItinerary(RouteDirKey key, String tripId,
                                      Map<String, TripInfo> tripInfos,
                                      Map<String, Line> linesByGtfsId,
                                      Map<String, Shape> shapesByGtfsId,
                                      Map<String, Itinerary> existingByExternalId) {
        TripInfo info = tripInfos.get(tripId);
        // Majority vote across every trip matching (route, direction) so
        // the representative trip alone doesn't underestimate
        // accessibility when the longest variant is the non-accessible one.
        WheelchairAccess wheelchairDefault =
                majorityWheelchair(tripInfos, key);
        BikesAllowed bikesDefault = majorityBikes(tripInfos, key);
        CarsAllowed carsDefault = majorityCars(tripInfos, key);

        // Null shape = the feed didn't ship a shape for this trip;
        // the future map view falls back to stop-to-stop lines.
        Shape shape = (info.shapeId() == null) ? null : shapesByGtfsId.get(info.shapeId());
        Short directionId = parseDirectionId(key.directionId());
        String externalId = truncate(tripId, 100);

        Itinerary itinerary = existingByExternalId.get(externalId);
        if (itinerary == null) {
            itinerary = Itinerary.builder().itineraryStops(new ArrayList<>()).build();
        } else {
            // orphanRemoval=true on the OneToMany picks up the cleared rows
            // when we save the parent again below.
            itinerary.clearItineraryStops();
        }
        // Single mutation site so a field added later can't silently miss
        // either the create or the update path.
        itinerary.setExternalId(externalId);
        itinerary.setLine(linesByGtfsId.get(key.routeId()));
        itinerary.setName(truncate(buildItineraryName(info.headsign(), key.directionId()),
                GtfsLimits.LINE_NAME_MAX_LENGTH));
        itinerary.setDirectionId(directionId);
        itinerary.setWheelchairDefault(wheelchairDefault);
        itinerary.setBikesAllowedDefault(bikesDefault);
        itinerary.setCarsAllowedDefault(carsDefault);
        itinerary.setSafeDurationFactor(info.safeDurationFactor());
        itinerary.setSafeDurationOffset(info.safeDurationOffset());
        itinerary.setMeanDurationFactor(info.meanDurationFactor());
        itinerary.setMeanDurationOffset(info.meanDurationOffset());
        itinerary.setShape(shape);
        return itineraryRepository.save(itinerary);
    }

    private void attachStops(Itinerary itinerary, List<TimedStop> trip,
                             StopImport stopImport, Line line, ItineraryBuildResult result) {
        int position = 0;
        Set<Stop> seenInItinerary = new HashSet<>();
        for (TimedStop ts : trip) {
            Stop stop = stopImport.stopsByGtfsId().get(ts.stopId());
            if (stop == null) {
                continue;
            }
            // Dedupe within itinerary (uk_itinerary_stop).
            if (!seenInItinerary.add(stop)) {
                continue;
            }
            ItineraryStop is = ItineraryStop.builder()
                    .itinerary(itinerary)
                    .stop(stop)
                    .position(position++)
                    .stopHeadsign(truncate(ts.headsign(), 100))
                    .build();
            itinerary.addItineraryStop(is);
            stop.addLine(line);
            result.stopsTouched.add(stop);
            result.itineraryStopCount++;
        }
    }

    /** Drops itineraries the new feed no longer declares. No FK is
     *  semantically attached from outside the import scope (no
     *  BroadcastMessage scope=ITINERARY exists), so a hard delete is safe. */
    private int removeOrphanedItineraries(Map<String, Itinerary> existing, Set<UUID> seen) {
        int orphans = 0;
        for (Itinerary old : existing.values()) {
            if (!seen.contains(old.getId())) {
                itineraryRepository.delete(old);
                orphans++;
            }
        }
        return orphans;
    }

    // ---------- majority-vote helpers ----------

    /**
     * Generic majority vote across the trips of a (route, direction).
     * Counts {@code 1} (yes) vs {@code 2} (no); ignores {@code 0}
     * (unknown). Returns {@code unknown} on a tie, on all-zero input,
     * or when no trip matches the key.
     */
    private static <E extends Enum<E>> E majorityVote(
            Map<String, TripInfo> tripInfos, RouteDirKey key,
            ToIntFunction<TripInfo> field,
            E yes, E no, E unknown) {
        int yesCount = 0;
        int noCount = 0;
        for (TripInfo info : tripInfos.values()) {
            if (!info.routeId().equals(key.routeId())) { continue; }
            if (!info.directionId().equals(key.directionId())) { continue; }
            int value = field.applyAsInt(info);
            if (value == 1) { yesCount++; }
            else if (value == 2) { noCount++; }
        }
        if (yesCount > noCount) { return yes; }
        if (noCount > yesCount) { return no; }
        return unknown;
    }

    /**
     * Picks the dominant {@code wheelchair_accessible} value among the trips
     * of a given (route, direction). Counts {@code 1} (accessible) vs
     * {@code 2} (not accessible); ignores {@code 0} (unknown). Falls back
     * to {@code UNKNOWN} when every trip is unspecified or evenly split.
     */
    public static WheelchairAccess majorityWheelchair(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        return majorityVote(tripInfos, key, TripInfo::wheelchairAccessible,
                WheelchairAccess.ACCESSIBLE, WheelchairAccess.NOT_ACCESSIBLE, WheelchairAccess.UNKNOWN);
    }

    /** Majority vote on {@code bikes_allowed}, mirroring {@link #majorityWheelchair}. */
    public static BikesAllowed majorityBikes(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        return majorityVote(tripInfos, key, TripInfo::bikesAllowed,
                BikesAllowed.ALLOWED, BikesAllowed.NOT_ALLOWED, BikesAllowed.UNKNOWN);
    }

    /**
     * Majority vote on {@code cars_allowed} (post-2023 trips.txt extension),
     * mirroring {@link #majorityBikes}.
     */
    public static CarsAllowed majorityCars(
            Map<String, TripInfo> tripInfos, RouteDirKey key) {
        return majorityVote(tripInfos, key, TripInfo::carsAllowed,
                CarsAllowed.ALLOWED, CarsAllowed.NOT_ALLOWED, CarsAllowed.UNKNOWN);
    }

    /**
     * Computes the per-schedule wheelchair override. Returns empty when the
     * trip's value matches the itinerary's default (the common case, so the
     * schedule row stores nothing).
     */
    public static Optional<Boolean> computeWheelchairOverride(int tripWheelchair,
            WheelchairAccess itineraryDefault) {
        if (tripWheelchair == 1) {
            return itineraryDefault == WheelchairAccess.ACCESSIBLE
                    ? Optional.empty() : Optional.of(Boolean.TRUE);
        }
        if (tripWheelchair == 2) {
            return itineraryDefault == WheelchairAccess.NOT_ACCESSIBLE
                    ? Optional.empty() : Optional.of(Boolean.FALSE);
        }
        return Optional.empty();
    }

    /**
     * Computes the per-schedule bikes override following the same
     * empty-means-inherit rule as {@link #computeWheelchairOverride}.
     */
    public static Optional<Boolean> computeBikesOverride(int tripBikes,
            BikesAllowed itineraryDefault) {
        if (tripBikes == 1) {
            return itineraryDefault == BikesAllowed.ALLOWED
                    ? Optional.empty() : Optional.of(Boolean.TRUE);
        }
        if (tripBikes == 2) {
            return itineraryDefault == BikesAllowed.NOT_ALLOWED
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
