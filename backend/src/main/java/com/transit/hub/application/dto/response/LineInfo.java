package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;

import java.util.UUID;

public record LineInfo(UUID id, String code, String name, String color) {
    public static LineInfo from(Line line) {
        return new LineInfo(line.getId(), line.getCode(), line.getName(), line.getColor());
    }
}
