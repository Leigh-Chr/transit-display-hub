package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.UserRole;

public record MeResponse(
        String username,
        UserRole role
) {}
