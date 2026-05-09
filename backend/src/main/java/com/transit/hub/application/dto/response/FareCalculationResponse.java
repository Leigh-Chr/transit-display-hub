package com.transit.hub.application.dto.response;

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
        String fromZoneId,
        String toStopId,
        String toStopName,
        String toZoneId,
        List<V1Option> v1,
        List<V2Option> v2
) {
    public record V1Option(
            String fareId,
            BigDecimal price,
            String currency,
            String paymentMethod,
            Integer transfers,
            Integer transferDurationSeconds,
            String agencyName,
            String matchedRoute,
            String matchedOriginZone,
            String matchedDestinationZone
    ) {}

    public record V2Option(
            String legGroupId,
            String fareProductId,
            String fareProductName,
            BigDecimal amount,
            String currency,
            String fromAreaId,
            String fromAreaName,
            String toAreaId,
            String toAreaName,
            Integer rulePriority,
            String networkId,
            String fromTimeframeGroupId,
            String toTimeframeGroupId
    ) {}
}
