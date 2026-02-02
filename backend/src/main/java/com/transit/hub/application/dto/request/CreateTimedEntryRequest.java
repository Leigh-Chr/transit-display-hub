package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record CreateTimedEntryRequest(
        @NotNull(message = "Time is required")
        @Pattern(regexp = "^([01]?[0-9]|2[0-3]):[0-5][0-9]$", message = "Time must be in HH:mm format")
        String time,

        @NotNull(message = "Route ID is required")
        UUID routeId
) {}
