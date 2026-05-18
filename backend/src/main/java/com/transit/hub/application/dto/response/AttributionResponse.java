package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Attribution;
import org.jspecify.annotations.Nullable;

public record AttributionResponse(
        String organizationName,
        boolean producer,
        boolean operator,
        boolean authority,
        @Nullable String url,
        @Nullable String email,
        @Nullable String phone
) {
    public static AttributionResponse from(Attribution a) {
        return new AttributionResponse(
                a.getOrganizationName(),
                a.isProducer(),
                a.isOperator(),
                a.isAuthority(),
                a.getUrl(),
                a.getEmail(),
                a.getPhone()
        );
    }
}
