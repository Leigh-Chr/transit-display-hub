package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.Set;
import java.util.UUID;

public record CreateStopRequest(
        @NotBlank(message = "{validation.stop.name.required}")
        @Size(max = 100, message = "{validation.stop.name.size}")
        String name,

        @NotEmpty(message = "{validation.stop.lineIds.required}")
        Set<UUID> lineIds,

        Double latitude,

        Double longitude
) {}
