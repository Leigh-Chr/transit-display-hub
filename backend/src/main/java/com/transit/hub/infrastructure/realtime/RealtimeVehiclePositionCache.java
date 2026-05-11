package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * In-memory cache of GTFS-Realtime {@code VehiclePosition}s. The
 * snapshot is replaced atomically; readers see a stable list across
 * the duration of a single render call.
 * <p>
 * Disabled when {@code app.gtfs-rt.vehicle-positions-url} is empty.
 * No passenger-facing surface yet — the kiosk doesn't render a map,
 * so positions are exposed via the admin browse endpoint only.
 */
@Component
@Slf4j
public class RealtimeVehiclePositionCache extends AbstractRealtimeFeedCache<List<RealtimeVehiclePositionCache.VehicleSnapshot>> {

    /**
     * Flat snapshot of one vehicle's position. We keep raw GTFS-RT
     * fields so the admin endpoint can surface the operator's data
     * verbatim — speed in m/s, bearing in degrees, occupancy as the
     * GTFS enum names. The downstream UI decides on units.
     */
    public record VehicleSnapshot(
            String entityId,
            String vehicleId,
            String vehicleLabel,
            String tripId,
            String routeId,
            Double latitude,
            Double longitude,
            Float bearing,
            Float speed,
            String currentStatus,
            String currentStopId,
            Integer currentStopSequence,
            String congestionLevel,
            String occupancyStatus,
            Integer occupancyPercentage,
            Long timestampEpochSeconds
    ) {}

    @Value("${app.gtfs-rt.vehicle-positions-url:}")
    private String vehiclePositionsUrl = "";

    @Value("${app.gtfs-rt.timeout-seconds:10}")
    private int timeoutSeconds = 10;

    @Override
    protected String feedUrl() {
        return vehiclePositionsUrl;
    }

    @Override
    protected int timeoutSeconds() {
        return timeoutSeconds;
    }

    @Override
    protected String kindLabel() {
        return "vehicle positions";
    }

    @Override
    protected List<VehicleSnapshot> parseSnapshot(GtfsRealtime.FeedMessage feed) {
        return parseVehicles(feed);
    }

    @Override
    protected List<VehicleSnapshot> emptySnapshot() {
        return List.of();
    }

    @Override
    protected int countEntries(List<VehicleSnapshot> snap) {
        return snap.size();
    }

    /** Returns the current snapshot, ordered by route then by vehicle id
     *  for stable admin browsing. The list is unmodifiable. */
    public List<VehicleSnapshot> currentSnapshot() {
        return snapshot.get();
    }

    static List<VehicleSnapshot> parseVehicles(GtfsRealtime.FeedMessage feed) {
        List<VehicleSnapshot> out = new ArrayList<>(feed.getEntityCount());
        for (GtfsRealtime.FeedEntity entity : feed.getEntityList()) {
            if (entity.getIsDeleted() || !entity.hasVehicle()) {
                continue;
            }
            GtfsRealtime.VehiclePosition v = entity.getVehicle();
            String vehicleId = v.hasVehicle() && v.getVehicle().hasId() ? v.getVehicle().getId() : null;
            String vehicleLabel = v.hasVehicle() && v.getVehicle().hasLabel() ? v.getVehicle().getLabel() : null;
            String tripId = v.hasTrip() && v.getTrip().hasTripId() ? v.getTrip().getTripId() : null;
            String routeId = v.hasTrip() && v.getTrip().hasRouteId() ? v.getTrip().getRouteId() : null;
            Double lat = v.hasPosition() ? (double) v.getPosition().getLatitude() : null;
            Double lon = v.hasPosition() ? (double) v.getPosition().getLongitude() : null;
            Float bearing = v.hasPosition() && v.getPosition().hasBearing()
                    ? v.getPosition().getBearing() : null;
            Float speed = v.hasPosition() && v.getPosition().hasSpeed()
                    ? v.getPosition().getSpeed() : null;
            String currentStatus = v.hasCurrentStatus() ? v.getCurrentStatus().name() : null;
            String stopId = v.hasStopId() ? v.getStopId() : null;
            Integer stopSequence = v.hasCurrentStopSequence() ? v.getCurrentStopSequence() : null;
            String congestion = v.hasCongestionLevel() ? v.getCongestionLevel().name() : null;
            String occupancyStatus = v.hasOccupancyStatus() ? v.getOccupancyStatus().name() : null;
            Integer occupancyPct = v.hasOccupancyPercentage() ? v.getOccupancyPercentage() : null;
            Long timestamp = v.hasTimestamp() ? v.getTimestamp() : null;
            out.add(new VehicleSnapshot(
                    entity.getId(), vehicleId, vehicleLabel, tripId, routeId,
                    lat, lon, bearing, speed, currentStatus, stopId, stopSequence,
                    congestion, occupancyStatus, occupancyPct, timestamp));
        }
        // Stable sort: by route id, then vehicle id. Uses null-safe
        // comparators because most feeds let either field be absent.
        out.sort((a, b) -> {
            int byRoute = nullSafeCompare(a.routeId(), b.routeId());
            if (byRoute != 0) {return byRoute;}
            return nullSafeCompare(a.vehicleId(), b.vehicleId());
        });
        return Collections.unmodifiableList(out);
    }

    private static int nullSafeCompare(String a, String b) {
        if (a == null && b == null) {return 0;}
        if (a == null) {return 1;}
        if (b == null) {return -1;}
        return a.compareTo(b);
    }
}
