package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Route;

import java.util.UUID;

public record RouteResponse(
        UUID id,
        String name,
        String terminusName,
        LineInfo line
) {
    public record LineInfo(UUID id, String code, String name, String color) {}

    public static RouteResponse from(Route route) {
        Line line = route.getLine();
        LineInfo lineInfo = new LineInfo(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor()
        );
        return new RouteResponse(
                route.getId(),
                route.getName(),
                route.getTerminusName(),
                lineInfo
        );
    }
}
