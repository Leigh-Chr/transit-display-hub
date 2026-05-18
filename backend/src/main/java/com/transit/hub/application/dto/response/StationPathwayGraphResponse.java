package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.StationLevel;
import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

/**
 * Indoor topology of a station — the graph of {@link PathwayResponse}s
 * scoped to one parent station, plus the {@link LevelInfo} rows the
 * pathways may reference. Returned by the public network-map endpoint
 * so the stop-popup can render "Pour rejoindre le quai 2, suivre
 * l'ascenseur jusqu'au niveau -1".
 */
public record StationPathwayGraphResponse(
        /** Parent station UUID, or the stop's own id when it is
         *  free-standing (no station). */
        UUID stationId,
        String stationName,
        List<LevelInfo> levels,
        List<PathwayResponse> pathways
) {
    public record LevelInfo(
            UUID id,
            String externalId,
            double index,
            @Nullable String name
    ) {
        public static LevelInfo from(StationLevel level) {
            return new LevelInfo(
                    level.getId(),
                    level.getExternalId(),
                    level.getLevelIndex(),
                    level.getLevelName()
            );
        }
    }
}
