package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

/**
 * Payload for {@code POST /api/auth/change-password}. The minimum
 * length matches the modern NIST 800-63B human-memorised secret guidance
 * (12 chars, no character-class rules); the maximum guards against the
 * occasional copy-paste of a multi-line blob.
 */
public record ChangePasswordRequest(
        @NotBlank(message = "{validation.password.required}")
        String currentPassword,

        @NotBlank(message = "{validation.password.required}")
        @Size(min = 12, max = 128, message = "{validation.password.length}")
        String newPassword
) {}
