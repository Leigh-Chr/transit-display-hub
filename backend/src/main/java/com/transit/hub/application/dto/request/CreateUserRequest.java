package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Payload for {@code POST /api/users}. The password floor matches
 * {@link ChangePasswordRequest} (12 chars, NIST 800-63B) so an admin
 * cannot seed a new account weaker than the minimum the same user
 * must clear on their first self-service rotation.
 */
public record CreateUserRequest(
        @NotBlank(message = "{validation.username.required}")
        @Size(min = 3, max = 50, message = "{validation.username.size}")
        String username,

        @NotBlank(message = "{validation.password.required}")
        @Size(min = 12, max = 128, message = "{validation.password.length}")
        String password,

        @NotNull(message = "{validation.user.role.required}")
        UserRole role
) {}
