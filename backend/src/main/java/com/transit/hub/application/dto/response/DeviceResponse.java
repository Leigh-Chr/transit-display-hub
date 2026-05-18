package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.enums.DeviceStatus;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

public record DeviceResponse(
        UUID id,
        UUID stopId,
        String stopName,
        List<LineInfo> lines,
        DeviceStatus status,
        @Nullable Instant lastHeartbeat
) {
    public static DeviceResponse from(Device device) {
        List<LineInfo> lines = LineInfo.fromSorted(device.getStop().getLines());

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
