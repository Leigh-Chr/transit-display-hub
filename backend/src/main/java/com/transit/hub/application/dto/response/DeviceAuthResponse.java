package com.transit.hub.application.dto.response;

import org.jspecify.annotations.Nullable;

import java.util.List;
import java.util.UUID;

public record DeviceAuthResponse(
        boolean valid,
        @Nullable UUID deviceId,
        @Nullable UUID stopId,
        @Nullable String stopName,
        @Nullable List<LineInfo> lines
) {}
