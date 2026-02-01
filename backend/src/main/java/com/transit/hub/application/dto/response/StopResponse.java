package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Stop;

import java.util.UUID;

public record StopResponse(
        UUID id,
        String name,
        LineInfo line,
        int scheduleCount
) {
    public record LineInfo(UUID id, String code, String name, String color) {}

    public static StopResponse from(Stop stop) {
        LineInfo lineInfo = new LineInfo(
                stop.getLine().getId(),
                stop.getLine().getCode(),
                stop.getLine().getName(),
                stop.getLine().getColor()
        );
        return new StopResponse(
                stop.getId(),
                stop.getName(),
                lineInfo,
                stop.getTimedEntries() != null ? stop.getTimedEntries().size() : 0
        );
    }
}
