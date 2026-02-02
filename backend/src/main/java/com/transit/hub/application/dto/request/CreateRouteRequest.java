package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateRouteRequest(
        @NotNull(message = "Line ID is required")
        UUID lineId,

        @NotBlank(message = "Name is required")
        @Size(max = 100, message = "Name must be at most 100 characters")
        String name,

        @NotBlank(message = "Terminus name is required")
        @Size(max = 100, message = "Terminus name must be at most 100 characters")
        String terminusName
) {}
