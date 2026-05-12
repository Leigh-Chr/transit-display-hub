package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CreateUserRequest(
        @NotBlank(message = "{validation.username.required}")
        @Size(min = 3, max = 50, message = "{validation.username.size}")
        String username,

        @NotBlank(message = "{validation.password.required}")
        @Size(min = 6, max = 100, message = "{validation.password.size}")
        String password,

        @NotNull(message = "{validation.user.role.required}")
        UserRole role
) {}
