package com.transit.hub.application.dto.response;

import java.util.List;
import java.util.UUID;

public record DeviceAuthResponse(
        boolean valid,
        UUID deviceId,
        UUID stopId,
        String stopName,
        List<LineInfo> lines
) {}
