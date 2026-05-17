package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.UserRole;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Payload for {@code PUT /api/users/{id}}. The optional new password is
 * held to the same 12-char floor as {@link CreateUserRequest} and
 * {@link ChangePasswordRequest} so a privileged admin reset cannot leak
 * weaker credentials into the system. {@code @Size} ignores {@code null}
 * — leaving the password field out means "do not change it".
 */
public record UpdateUserRequest(
        @Size(min = 12, max = 128, message = "{validation.password.length}")
        String password,

        @NotNull(message = "{validation.user.role.required}")
        UserRole role,

        @NotNull(message = "{validation.user.enabled.required}")
        Boolean enabled
) {}
