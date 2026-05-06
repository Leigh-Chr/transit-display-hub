package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.enums.LineType;

import java.util.UUID;

public record LineResponse(
        UUID id,
        String code,
        String name,
        String color,
        String textColor,
        LineType type,
        Integer sortOrder,
        String description,
        String url,
        /** Identifier of the operating agency. Null for lines created via
         *  the legacy admin form or imported from feeds without
         *  agency.txt. */
        UUID agencyId,
        /** Convenience name of the operating agency, denormalised so the
         *  admin UI can render the column without a second request. */
        String agencyName,
        int stopCount,
        int itineraryCount
) {
    public static LineResponse from(Line line) {
        return new LineResponse(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor(),
                line.getTextColor(),
                line.getType(),
                line.getSortOrder(),
                line.getDescription(),
                line.getUrl(),
                line.getAgency() != null ? line.getAgency().getId() : null,
                line.getAgency() != null ? line.getAgency().getName() : null,
                line.getStops() != null ? line.getStops().size() : 0,
                line.getItineraries() != null ? line.getItineraries().size() : 0
        );
    }
}
