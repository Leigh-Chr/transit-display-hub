package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AddItineraryStopRequest(
        @NotNull(message = "Stop ID is required")
        UUID stopId,

        Integer position
) {}
