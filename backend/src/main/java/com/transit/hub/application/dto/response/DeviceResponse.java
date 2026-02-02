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
        List<String> lineCodes,
        DeviceStatus status,
        Instant lastHeartbeat
) {
    public static DeviceResponse from(Device device) {
        List<String> lineCodes = device.getStop().getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(Line::getCode)
                .toList();

        return new DeviceResponse(
                device.getId(),
                device.getStop().getId(),
                device.getStop().getName(),
                lineCodes,
                device.getStatus(),
                device.getLastHeartbeat()
        );
    }
}
