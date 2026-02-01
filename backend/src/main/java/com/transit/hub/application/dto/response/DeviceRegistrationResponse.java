package com.transit.hub.application.dto.response;

import java.util.UUID;

public record DeviceRegistrationResponse(
        UUID id,
        String token,
        UUID stopId,
        String stopName
) {}
