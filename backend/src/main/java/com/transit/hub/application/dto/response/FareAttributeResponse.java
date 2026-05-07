package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.FareAttribute;
import com.transit.hub.domain.model.enums.FarePaymentMethod;

import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;

/**
 * Read-only DTO for the admin fare browse endpoint. Carries a fare
 * attribute (price, currency, transfer policy) plus its inline rules
 * so the admin sees the full applicability picture in one payload.
 */
public record FareAttributeResponse(
        UUID id,
        String externalId,
        BigDecimal price,
        String currency,
        FarePaymentMethod paymentMethod,
        Integer transfers,
        Integer transferDuration,
        UUID agencyId,
        String agencyName,
        List<RuleSummary> rules
) {
    public record RuleSummary(
            UUID id,
            UUID routeId,
            String routeCode,
            String originId,
            String destinationId,
            String containsId
    ) {}

    public static FareAttributeResponse from(FareAttribute fa) {
        return new FareAttributeResponse(
                fa.getId(),
                fa.getExternalId(),
                fa.getPrice(),
                fa.getCurrency(),
                fa.getPaymentMethod(),
                fa.getTransfers(),
                fa.getTransferDuration(),
                fa.getAgency() != null ? fa.getAgency().getId() : null,
                fa.getAgency() != null ? fa.getAgency().getName() : null,
                fa.getRules() == null ? List.of() : fa.getRules().stream()
                        .map(r -> new RuleSummary(
                                r.getId(),
                                r.getRoute() != null ? r.getRoute().getId() : null,
                                r.getRoute() != null ? r.getRoute().getCode() : null,
                                r.getOriginId(),
                                r.getDestinationId(),
                                r.getContainsId()))
                        .toList()
        );
    }
}
