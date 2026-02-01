package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.UserRole;

import java.time.Instant;

public record LoginResponse(
        String token,
        Instant expiresAt,
        UserRole role,
        String username
) {}
