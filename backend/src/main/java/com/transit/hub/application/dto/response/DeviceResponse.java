package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.enums.DeviceStatus;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record DeviceResponse(
        UUID id,
        UUID stopId,
        String stopName,
        List<LineInfo> lines,
        DeviceStatus status,
        Instant lastHeartbeat
) {
    public record LineInfo(String code, String name, String color) {}

    public static DeviceResponse from(Device device) {
        List<LineInfo> lines = device.getStop().getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(line -> new LineInfo(line.getCode(), line.getName(), line.getColor()))
                .toList();

        return new DeviceResponse(
                device.getId(),
                device.getStop().getId(),
                device.getStop().getName(),
                lines,
                device.getStatus(),
                device.getLastHeartbeat()
        );
    }
}
