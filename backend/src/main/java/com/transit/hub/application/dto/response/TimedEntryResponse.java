package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.TimedEntry;

import java.time.LocalTime;
import java.util.UUID;

public record TimedEntryResponse(
        UUID id,
        LocalTime time,
        UUID stopId,
        LineInfo line
) {
    public record LineInfo(UUID id, String code, String name, String color) {}

    public static TimedEntryResponse from(TimedEntry entry) {
        Line line = entry.getLine();
        LineInfo lineInfo = new LineInfo(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor()
        );
        return new TimedEntryResponse(
                entry.getId(),
                entry.getTime(),
                entry.getStop().getId(),
                lineInfo
        );
    }
}
