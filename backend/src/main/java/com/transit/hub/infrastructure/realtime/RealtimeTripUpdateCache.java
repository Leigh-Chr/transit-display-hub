package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import com.transit.hub.infrastructure.config.GtfsRtProperties;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * In-memory cache of GTFS-Realtime {@code TripUpdate}s. Indexes the
 * snapshot by GTFS {@code trip_id} so the display calculator can look
 * up the delay for a given itinerary in O(1) without locking.
 * <p>
 * Disabled when {@code app.gtfs-rt.trip-updates-url} is empty:
 * {@link #findUpdate(String)} returns {@link Optional#empty()} and
 * the kiosk shows scheduled times. The same URL pattern as
 * {@link RealtimeAlertCache} keeps the operator config symmetric.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RealtimeTripUpdateCache extends AbstractRealtimeFeedCache<Map<String, RealtimeTripUpdateCache.TripAdjustment>> {

    private final GtfsRtProperties properties;

    /**
     * Per-stop adjustment carried by a {@link GtfsRealtime.TripUpdate.StopTimeUpdate}.
     * Carries either an explicit delay (preferred) or a wall-clock
     * arrival time we can compare against the schedule. Skipped stops
     * surface with {@link #skipped()} = true so the kiosk can hide
     * the row entirely rather than show a stale time.
     */
    public record StopAdjustment(
            String stopExternalId,
            Integer arrivalDelaySeconds,
            Integer departureDelaySeconds,
            Long arrivalEpochSeconds,
            Long departureEpochSeconds,
            boolean skipped
    ) {
        public Integer effectiveDelaySeconds() {
            if (arrivalDelaySeconds != null) {return arrivalDelaySeconds;}
            return departureDelaySeconds;
        }
    }

    /**
     * Per-trip set of adjustments. The trip-level {@code delay}
     * (when set) is the default applied to every stop the
     * stop_time_update list doesn't override.
     *
     * <p>{@code vehicleId} / {@code vehicleLabel} carry the
     * {@code TripUpdate.vehicle} VehicleDescriptor — the operator's
     * fleet identifier (id) and the human-readable label (line code
     * on the windscreen) for cross-referencing with a vehicle
     * positions feed. {@code timestampEpochSeconds} carries
     * {@code TripUpdate.timestamp}, the moment the producer measured
     * the trip's adjusted state. All three are nullable when the
     * producer omits them.
     */
    public record TripAdjustment(
            String tripId,
            Integer tripLevelDelaySeconds,
            String vehicleId,
            String vehicleLabel,
            Long timestampEpochSeconds,
            Map<String, StopAdjustment> byStopExternalId
    ) {}

    @Override
    protected String feedUrl() {
        return properties.tripUpdatesUrl();
    }

    @Override
    protected int timeoutSeconds() {
        return properties.timeoutSeconds();
    }

    @Override
    protected String kindLabel() {
        return "trip updates";
    }

    @Override
    protected Map<String, TripAdjustment> parseSnapshot(GtfsRealtime.FeedMessage feed) {
        return parseTripUpdates(feed);
    }

    @Override
    protected Map<String, TripAdjustment> emptySnapshot() {
        return Map.of();
    }

    @Override
    protected int countEntries(Map<String, TripAdjustment> snap) {
        return snap.size();
    }

    /** Number of trips currently in the cache. Used by the
     *  data-overview dashboard. */
    public int snapshotSize() {
        return snapshot.get().size();
    }

    public Optional<TripAdjustment> findUpdate(String tripExternalId) {
        if (tripExternalId == null) {return Optional.empty();}
        TripAdjustment hit = snapshot.get().get(tripExternalId);
        return Optional.ofNullable(hit);
    }

    static Map<String, TripAdjustment> parseTripUpdates(GtfsRealtime.FeedMessage feed) {
        Map<String, TripAdjustment> out = new HashMap<>();
        for (GtfsRealtime.FeedEntity entity : feed.getEntityList()) {
            if (entity.getIsDeleted() || !entity.hasTripUpdate()) {
                continue;
            }
            GtfsRealtime.TripUpdate update = entity.getTripUpdate();
            if (!update.hasTrip() || !update.getTrip().hasTripId()) {
                continue;
            }
            TripAdjustment adjustment = toTripAdjustment(update);
            out.put(adjustment.tripId(), adjustment);
        }
        return Map.copyOf(out);
    }

    private static TripAdjustment toTripAdjustment(GtfsRealtime.TripUpdate update) {
        Map<String, StopAdjustment> byStop = new HashMap<>();
        for (GtfsRealtime.TripUpdate.StopTimeUpdate stu : update.getStopTimeUpdateList()) {
            // We don't yet model stop_sequence-only updates; they would need
            // the schedule's sequence number, which the calculator doesn't carry.
            if (!stu.hasStopId()) {
                continue;
            }
            byStop.put(stu.getStopId(), toStopAdjustment(stu));
        }
        return new TripAdjustment(
                update.getTrip().getTripId(),
                update.hasDelay() ? update.getDelay() : null,
                vehicleId(update),
                vehicleLabel(update),
                update.hasTimestamp() ? update.getTimestamp() : null,
                Map.copyOf(byStop));
    }

    private static StopAdjustment toStopAdjustment(GtfsRealtime.TripUpdate.StopTimeUpdate stu) {
        boolean skipped = stu.getScheduleRelationship()
                == GtfsRealtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED;
        Integer arrDelay = stu.hasArrival() && stu.getArrival().hasDelay()
                ? stu.getArrival().getDelay() : null;
        Long arrTime = stu.hasArrival() && stu.getArrival().hasTime()
                ? stu.getArrival().getTime() : null;
        Integer depDelay = stu.hasDeparture() && stu.getDeparture().hasDelay()
                ? stu.getDeparture().getDelay() : null;
        Long depTime = stu.hasDeparture() && stu.getDeparture().hasTime()
                ? stu.getDeparture().getTime() : null;
        return new StopAdjustment(stu.getStopId(), arrDelay, depDelay, arrTime, depTime, skipped);
    }

    private static String vehicleId(GtfsRealtime.TripUpdate update) {
        return update.hasVehicle() && update.getVehicle().hasId() ? update.getVehicle().getId() : null;
    }

    private static String vehicleLabel(GtfsRealtime.TripUpdate update) {
        return update.hasVehicle() && update.getVehicle().hasLabel() ? update.getVehicle().getLabel() : null;
    }
}
