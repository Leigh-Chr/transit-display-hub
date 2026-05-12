package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record UpdateUserRequest(
        @Size(min = 6, max = 100, message = "{validation.password.size}")
        String password,

        @NotNull(message = "{validation.user.role.required}")
        UserRole role,

        @NotNull(message = "{validation.user.enabled.required}")
        Boolean enabled
) {}
