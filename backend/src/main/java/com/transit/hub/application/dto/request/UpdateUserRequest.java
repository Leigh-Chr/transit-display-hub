package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @Size(min = 6, max = 100, message = "Password must be between 6 and 100 characters")
        String password,

        @NotNull(message = "Role is required")
        UserRole role,

        @NotNull(message = "Enabled status is required")
        Boolean enabled
) {}
