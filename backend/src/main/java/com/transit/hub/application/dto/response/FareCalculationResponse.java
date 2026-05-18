package com.transit.hub.application.dto.response;

import org.jspecify.annotations.Nullable;

import java.math.BigDecimal;
import java.util.List;

/**
 * Result of a {@code GET /api/fares/calculate?from=…&to=…} request:
 * the V1 fares (legacy {@code fare_attributes} + {@code fare_rules})
 * and the V2 leg rules whose origin/destination areas match.
 *
 * Both surfaces are returned because feeds in the wild ship one or
 * the other — sometimes both for backward compatibility — and the
 * caller is expected to render whichever is non-empty.
 */
public record FareCalculationResponse(
        String fromStopId,
        String fromStopName,
        @Nullable String fromZoneId,
        String toStopId,
        String toStopName,
        @Nullable String toZoneId,
        List<V1Option> v1,
        List<V2Option> v2
) {
    public record V1Option(
            String fareId,
            @Nullable BigDecimal price,
            String currency,
            @Nullable String paymentMethod,
            @Nullable Integer transfers,
            @Nullable Integer transferDurationSeconds,
            @Nullable String agencyName,
            @Nullable String matchedRoute,
            @Nullable String matchedOriginZone,
            @Nullable String matchedDestinationZone
    ) {}

    public record V2Option(
            @Nullable String legGroupId,
            @Nullable String fareProductId,
            @Nullable String fareProductName,
            @Nullable BigDecimal amount,
            @Nullable String currency,
            @Nullable String fromAreaId,
            @Nullable String fromAreaName,
            @Nullable String toAreaId,
            @Nullable String toAreaName,
            @Nullable Integer rulePriority,
            @Nullable String networkId,
            @Nullable String fromTimeframeGroupId,
            @Nullable String toTimeframeGroupId
    ) {}
}
