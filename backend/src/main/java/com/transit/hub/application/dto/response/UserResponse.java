package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;

import java.util.UUID;

public record UserResponse(
        UUID id,
        String username,
        UserRole role,
        boolean enabled
) {
    public static UserResponse from(User user) {
        return new UserResponse(
                user.getId(),
                user.getUsername(),
                user.getRole(),
                user.isEnabled()
        );
    }
}
