package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Agency;

import java.util.UUID;

public record AgencyResponse(
        UUID id,
        String externalId,
        String name,
        String url,
        String timezone,
        String lang,
        String phone,
        String fareUrl,
        String email
) {
    public static AgencyResponse from(Agency agency) {
        return new AgencyResponse(
                agency.getId(),
                agency.getExternalId(),
                agency.getName(),
                agency.getUrl(),
                agency.getTimezone(),
                agency.getLang(),
                agency.getPhone(),
                agency.getFareUrl(),
                agency.getEmail()
        );
    }
}
