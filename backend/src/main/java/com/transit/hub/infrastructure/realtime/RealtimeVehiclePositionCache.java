package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import com.transit.hub.infrastructure.config.GtfsRtProperties;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.net.http.HttpClient;
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

    private final GtfsRtProperties properties;

    public RealtimeVehiclePositionCache(GtfsRtProperties properties, HttpClient gtfsRtHttpClient) {
        super(gtfsRtHttpClient);
        this.properties = properties;
    }

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

    @Override
    protected String feedUrl() {
        return properties.vehiclePositionsUrl();
    }

    @Override
    protected int timeoutSeconds() {
        return properties.timeoutSeconds();
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
            out.add(toSnapshot(entity));
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

    private static VehicleSnapshot toSnapshot(GtfsRealtime.FeedEntity entity) {
        GtfsRealtime.VehiclePosition v = entity.getVehicle();
        return new VehicleSnapshot(
                entity.getId(),
                vehicleId(v), vehicleLabel(v),
                tripId(v), routeId(v),
                latitude(v), longitude(v), bearing(v), speed(v),
                currentStatus(v), stopId(v), stopSequence(v),
                congestion(v), occupancyStatus(v), occupancyPct(v),
                timestamp(v));
    }

    private static String vehicleId(GtfsRealtime.VehiclePosition v) {
        return v.hasVehicle() && v.getVehicle().hasId() ? v.getVehicle().getId() : null;
    }
    private static String vehicleLabel(GtfsRealtime.VehiclePosition v) {
        return v.hasVehicle() && v.getVehicle().hasLabel() ? v.getVehicle().getLabel() : null;
    }
    private static String tripId(GtfsRealtime.VehiclePosition v) {
        return v.hasTrip() && v.getTrip().hasTripId() ? v.getTrip().getTripId() : null;
    }
    private static String routeId(GtfsRealtime.VehiclePosition v) {
        return v.hasTrip() && v.getTrip().hasRouteId() ? v.getTrip().getRouteId() : null;
    }
    private static Double latitude(GtfsRealtime.VehiclePosition v) {
        return v.hasPosition() ? (double) v.getPosition().getLatitude() : null;
    }
    private static Double longitude(GtfsRealtime.VehiclePosition v) {
        return v.hasPosition() ? (double) v.getPosition().getLongitude() : null;
    }
    private static Float bearing(GtfsRealtime.VehiclePosition v) {
        return v.hasPosition() && v.getPosition().hasBearing() ? v.getPosition().getBearing() : null;
    }
    private static Float speed(GtfsRealtime.VehiclePosition v) {
        return v.hasPosition() && v.getPosition().hasSpeed() ? v.getPosition().getSpeed() : null;
    }
    private static String currentStatus(GtfsRealtime.VehiclePosition v) {
        return v.hasCurrentStatus() ? v.getCurrentStatus().name() : null;
    }
    private static String stopId(GtfsRealtime.VehiclePosition v) {
        return v.hasStopId() ? v.getStopId() : null;
    }
    private static Integer stopSequence(GtfsRealtime.VehiclePosition v) {
        return v.hasCurrentStopSequence() ? v.getCurrentStopSequence() : null;
    }
    private static String congestion(GtfsRealtime.VehiclePosition v) {
        return v.hasCongestionLevel() ? v.getCongestionLevel().name() : null;
    }
    private static String occupancyStatus(GtfsRealtime.VehiclePosition v) {
        return v.hasOccupancyStatus() ? v.getOccupancyStatus().name() : null;
    }
    private static Integer occupancyPct(GtfsRealtime.VehiclePosition v) {
        return v.hasOccupancyPercentage() ? v.getOccupancyPercentage() : null;
    }
    private static Long timestamp(GtfsRealtime.VehiclePosition v) {
        return v.hasTimestamp() ? v.getTimestamp() : null;
    }

    private static int nullSafeCompare(String a, String b) {
        if (a == null && b == null) {return 0;}
        if (a == null) {return 1;}
        if (b == null) {return -1;}
        return a.compareTo(b);
    }
}
