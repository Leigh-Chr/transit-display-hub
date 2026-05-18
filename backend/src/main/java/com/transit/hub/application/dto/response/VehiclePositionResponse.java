package com.transit.hub.application.dto.response;

import org.jspecify.annotations.Nullable;

/**
 * Read-only DTO over a single GTFS-Realtime {@code VehiclePosition}.
 * Mirrors the cached snapshot one-for-one — admins consume the
 * operator's data verbatim, no normalisation.
 */
public record VehiclePositionResponse(
        String entityId,
        @Nullable String vehicleId,
        @Nullable String vehicleLabel,
        @Nullable String tripId,
        @Nullable String routeId,
        @Nullable Double latitude,
        @Nullable Double longitude,
        @Nullable Float bearing,
        @Nullable Float speedMetresPerSecond,
        @Nullable String currentStatus,
        @Nullable String currentStopId,
        @Nullable Integer currentStopSequence,
        @Nullable String congestionLevel,
        @Nullable String occupancyStatus,
        @Nullable Integer occupancyPercentage,
        @Nullable Long timestampEpochSeconds
) {
}
