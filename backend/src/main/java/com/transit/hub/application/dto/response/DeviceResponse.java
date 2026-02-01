package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.enums.DeviceStatus;

import java.time.Instant;
import java.util.UUID;

public record DeviceResponse(
        UUID id,
        UUID stopId,
        String stopName,
        String lineCode,
        DeviceStatus status,
        Instant lastHeartbeat
) {
    public static DeviceResponse from(Device device) {
        return new DeviceResponse(
                device.getId(),
                device.getStop().getId(),
                device.getStop().getName(),
                device.getStop().getLine().getCode(),
                device.getStatus(),
                device.getLastHeartbeat()
        );
    }
}
