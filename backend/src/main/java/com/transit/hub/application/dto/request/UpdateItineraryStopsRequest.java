package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.List;
import java.util.UUID;

public record UpdateItineraryStopsRequest(
        @NotNull(message = "Stop IDs are required")
        List<UUID> stopIds
) {}
