package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.enums.PathwayMode;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * Indoor topology segment between two stops, surfacing GTFS
 * {@code pathways.txt} so the admin (and a future hub-display
 * accessibility filter) can reason about elevators, stairs and
 * traversal times without joining tables client-side.
 */
public record PathwayResponse(
        UUID id,
        String externalId,
        UUID fromStopId,
        String fromStopName,
        UUID toStopId,
        String toStopName,
        PathwayMode pathwayMode,
        boolean bidirectional,
        @Nullable Double lengthMetres,
        @Nullable Integer traversalTimeSeconds,
        @Nullable Integer stairCount,
        @Nullable Double maxSlope,
        @Nullable Double minWidthMetres,
        @Nullable String signpostedAs,
        @Nullable String reversedSignpostedAs
) {
    public static PathwayResponse from(Pathway p) {
        return new PathwayResponse(
                p.getId(),
                p.getExternalId(),
                p.getFromStop().getId(),
                p.getFromStop().getName(),
                p.getToStop().getId(),
                p.getToStop().getName(),
                p.getPathwayMode(),
                p.isBidirectional(),
                p.getLengthMetres(),
                p.getTraversalTimeSeconds(),
                p.getStairCount(),
                p.getMaxSlope(),
                p.getMinWidthMetres(),
                p.getSignpostedAs(),
                p.getReversedSignpostedAs()
        );
    }
}
