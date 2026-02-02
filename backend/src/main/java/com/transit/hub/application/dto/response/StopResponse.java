package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record StopResponse(
        UUID id,
        String name,
        List<LineInfo> lines,
        int scheduleCount
) {
    public record LineInfo(UUID id, String code, String name, String color) {}

    public static StopResponse from(Stop stop) {
        List<LineInfo> lineInfos = stop.getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(line -> new LineInfo(
                        line.getId(),
                        line.getCode(),
                        line.getName(),
                        line.getColor()
                ))
                .toList();

        return new StopResponse(
                stop.getId(),
                stop.getName(),
                lineInfos,
                stop.getTimedEntries() != null ? stop.getTimedEntries().size() : 0
        );
    }
}
