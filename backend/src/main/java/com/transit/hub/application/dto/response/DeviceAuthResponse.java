package com.transit.hub.application.dto.response;

import java.util.UUID;

public record DeviceAuthResponse(
        boolean valid,
        UUID stopId,
        String stopName,
        String lineCode
) {}
