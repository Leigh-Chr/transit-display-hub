package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

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
public class RealtimeVehiclePositionCache {

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

    private final AtomicReference<List<VehicleSnapshot>> snapshot =
            new AtomicReference<>(List.of());

    /** Header metadata captured on the most recent successful refresh.
     *  Reset to {@link FeedHeaderInfo#empty()} on construction. */
    private final AtomicReference<FeedHeaderInfo> headerRef =
            new AtomicReference<>(FeedHeaderInfo.empty());

    @Value("${app.gtfs-rt.vehicle-positions-url:}")
    private String vehiclePositionsUrl = "";

    @Value("${app.gtfs-rt.timeout-seconds:10}")
    private int timeoutSeconds = 10;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public boolean isEnabled() {
        return vehiclePositionsUrl != null && !vehiclePositionsUrl.isBlank();
    }

    /** Returns the current snapshot, ordered by route then by vehicle id
     *  for stable admin browsing. The list is unmodifiable. */
    public List<VehicleSnapshot> currentSnapshot() {
        return snapshot.get();
    }

    /** Header captured on the last successful refresh. Returns
     *  {@link FeedHeaderInfo#empty()} when no refresh has succeeded
     *  yet, so consumers always get a non-null record. */
    public FeedHeaderInfo currentHeader() {
        return headerRef.get();
    }

    public void refresh() {
        if (!isEnabled()) {
            return;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(vehiclePositionsUrl))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Accept", "application/x-protobuf, application/octet-stream")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() != 200) {
                log.warn("GTFS-RT vehicle positions: HTTP {} from {}", response.statusCode(), vehiclePositionsUrl);
                return;
            }
            try (InputStream in = response.body()) {
                GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.parseFrom(in);
                List<VehicleSnapshot> parsed = parseVehicles(feed);
                snapshot.set(parsed);
                headerRef.set(RealtimeAlertCache.parseHeader(feed));
                log.info("GTFS-RT vehicle positions: refreshed snapshot with {} vehicles", parsed.size());
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("GTFS-RT vehicle positions: refresh interrupted: {}", e.getMessage());
        } catch (IOException e) {
            log.warn("GTFS-RT vehicle positions: refresh failed: {}", e.getMessage());
        }
    }

    private static List<VehicleSnapshot> parseVehicles(GtfsRealtime.FeedMessage feed) {
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
