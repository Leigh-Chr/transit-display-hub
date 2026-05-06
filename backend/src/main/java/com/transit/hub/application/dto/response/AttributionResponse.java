package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Attribution;

public record AttributionResponse(
        String organizationName,
        boolean producer,
        boolean operator,
        boolean authority,
        String url,
        String email,
        String phone
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
