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
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

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
@Slf4j
public class RealtimeTripUpdateCache {

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

    private final AtomicReference<Map<String, TripAdjustment>> snapshot =
            new AtomicReference<>(Map.of());

    /** Header metadata captured on the most recent successful refresh.
     *  Reset to {@link FeedHeaderInfo#empty()} on construction. */
    private final AtomicReference<FeedHeaderInfo> headerRef =
            new AtomicReference<>(FeedHeaderInfo.empty());

    @Value("${app.gtfs-rt.trip-updates-url:}")
    private String tripUpdatesUrl = "";

    @Value("${app.gtfs-rt.timeout-seconds:10}")
    private int timeoutSeconds = 10;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    public boolean isEnabled() {
        return tripUpdatesUrl != null && !tripUpdatesUrl.isBlank();
    }

    /** Number of trips currently in the cache. Used by the
     *  data-overview dashboard. */
    public int snapshotSize() {
        return snapshot.get().size();
    }

    /** Header captured on the last successful refresh. Returns
     *  {@link FeedHeaderInfo#empty()} when no refresh has succeeded
     *  yet, so consumers always get a non-null record. */
    public FeedHeaderInfo currentHeader() {
        return headerRef.get();
    }

    public Optional<TripAdjustment> findUpdate(String tripExternalId) {
        if (tripExternalId == null) {return Optional.empty();}
        TripAdjustment hit = snapshot.get().get(tripExternalId);
        return Optional.ofNullable(hit);
    }

    /**
     * Fetches the trip updates feed and atomically replaces the cached
     * snapshot. Failures leave the previous snapshot in place — the
     * kiosk falls back to scheduled times rather than dropping all
     * realtime data on a single hiccup.
     */
    public void refresh() {
        if (!isEnabled()) {
            return;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(tripUpdatesUrl))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Accept", "application/x-protobuf, application/octet-stream")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() != 200) {
                log.warn("GTFS-RT trip updates: HTTP {} from {}", response.statusCode(), tripUpdatesUrl);
                return;
            }
            try (InputStream in = response.body()) {
                GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.parseFrom(in);
                Map<String, TripAdjustment> indexed = parseTripUpdates(feed);
                snapshot.set(indexed);
                headerRef.set(RealtimeAlertCache.parseHeader(feed));
                log.info("GTFS-RT trip updates: refreshed snapshot with {} trips", indexed.size());
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("GTFS-RT trip updates: refresh failed: {}", e.getMessage());
        }
    }

    private static Map<String, TripAdjustment> parseTripUpdates(GtfsRealtime.FeedMessage feed) {
        Map<String, TripAdjustment> out = new HashMap<>();
        for (GtfsRealtime.FeedEntity entity : feed.getEntityList()) {
            if (entity.getIsDeleted() || !entity.hasTripUpdate()) {
                continue;
            }
            GtfsRealtime.TripUpdate update = entity.getTripUpdate();
            if (!update.hasTrip() || !update.getTrip().hasTripId()) {
                continue;
            }
            String tripId = update.getTrip().getTripId();
            Integer tripLevelDelay = update.hasDelay() ? update.getDelay() : null;
            String vehicleId = update.hasVehicle() && update.getVehicle().hasId()
                    ? update.getVehicle().getId() : null;
            String vehicleLabel = update.hasVehicle() && update.getVehicle().hasLabel()
                    ? update.getVehicle().getLabel() : null;
            Long updateTimestamp = update.hasTimestamp() ? update.getTimestamp() : null;
            Map<String, StopAdjustment> byStop = new HashMap<>();
            for (GtfsRealtime.TripUpdate.StopTimeUpdate stu : update.getStopTimeUpdateList()) {
                if (!stu.hasStopId()) {
                    // We don't yet model stop_sequence-only updates;
                    // they would need the schedule's sequence number,
                    // which the calculator doesn't carry.
                    continue;
                }
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
                byStop.put(stu.getStopId(), new StopAdjustment(
                        stu.getStopId(), arrDelay, depDelay, arrTime, depTime, skipped));
            }
            out.put(tripId, new TripAdjustment(
                    tripId, tripLevelDelay, vehicleId, vehicleLabel, updateTimestamp,
                    Map.copyOf(byStop)));
        }
        return Map.copyOf(out);
    }
}
