package com.transit.hub.application.dto.response;

import com.transit.hub.infrastructure.realtime.RealtimeVehiclePositionCache;

/**
 * Read-only DTO over a single GTFS-Realtime {@code VehiclePosition}.
 * Mirrors the cached snapshot one-for-one — admins consume the
 * operator's data verbatim, no normalisation.
 */
public record VehiclePositionResponse(
        String entityId,
        String vehicleId,
        String vehicleLabel,
        String tripId,
        String routeId,
        Double latitude,
        Double longitude,
        Float bearing,
        Float speedMetresPerSecond,
        String currentStatus,
        String currentStopId,
        Integer currentStopSequence,
        String congestionLevel,
        String occupancyStatus,
        Integer occupancyPercentage,
        Long timestampEpochSeconds
) {
    public static VehiclePositionResponse from(RealtimeVehiclePositionCache.VehicleSnapshot snap) {
        return new VehiclePositionResponse(
                snap.entityId(),
                snap.vehicleId(),
                snap.vehicleLabel(),
                snap.tripId(),
                snap.routeId(),
                snap.latitude(),
                snap.longitude(),
                snap.bearing(),
                snap.speed(),
                snap.currentStatus(),
                snap.currentStopId(),
                snap.currentStopSequence(),
                snap.congestionLevel(),
                snap.occupancyStatus(),
                snap.occupancyPercentage(),
                snap.timestampEpochSeconds()
        );
    }
}
