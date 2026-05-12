package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.List;
import java.util.UUID;

public record CreateItineraryRequest(
        @NotNull(message = "{validation.line.id.required}")
        UUID lineId,

        @NotBlank(message = "{validation.itinerary.name.required}")
        @Size(max = 100, message = "{validation.itinerary.name.size}")
        String name,

        List<UUID> stopIds
) {}
