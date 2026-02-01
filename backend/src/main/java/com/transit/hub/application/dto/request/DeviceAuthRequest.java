package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotBlank;

public record DeviceAuthRequest(
        @NotBlank(message = "Token is required")
        String token
) {}
