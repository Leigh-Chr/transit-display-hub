package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record StopResponse(
        UUID id,
        String name,
        Double latitude,
        Double longitude,
        List<LineInfo> lines,
        int scheduleCount,
        boolean hasDevice
) {
    public static StopResponse from(Stop stop) {
        List<LineInfo> lineInfos = stop.getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(LineInfo::from)
                .toList();

        return new StopResponse(
                stop.getId(),
                stop.getName(),
                stop.getLatitude(),
                stop.getLongitude(),
                lineInfos,
                stop.getSchedules() != null ? stop.getSchedules().size() : 0,
                stop.getDevices() != null && !stop.getDevices().isEmpty()
        );
    }
}
