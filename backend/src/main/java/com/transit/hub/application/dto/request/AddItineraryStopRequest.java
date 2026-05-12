package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotNull;

import java.util.UUID;

public record AddItineraryStopRequest(
        @NotNull(message = "{validation.stop.id.required}")
        UUID stopId,

        Integer position
) {}
