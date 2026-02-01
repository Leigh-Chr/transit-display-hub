package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;

import java.util.UUID;

public record LineResponse(
        UUID id,
        String code,
        String name,
        String color,
        int stopCount
) {
    public static LineResponse from(Line line) {
        return new LineResponse(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor(),
                line.getStops() != null ? line.getStops().size() : 0
        );
    }
}
