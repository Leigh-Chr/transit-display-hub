package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.FareLegJoinRule;
import com.transit.hub.domain.model.FareLegRule;
import com.transit.hub.domain.model.FareMedia;
import com.transit.hub.domain.model.FareProduct;
import com.transit.hub.domain.model.FareTransferRule;
import com.transit.hub.domain.model.Network;
import com.transit.hub.domain.model.Timeframe;

import java.math.BigDecimal;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

/**
 * Aggregate Fares v2 admin payload — areas, timeframes, products,
 * leg rules and transfer rules in a single round-trip. Read-only;
 * mirrors the persisted shape one-for-one so the UI can audit the
 * import without joining tables client-side.
 */
public record FaresV2Response(
        List<AreaSummary> areas,
        List<TimeframeSummary> timeframes,
        List<ProductSummary> products,
        List<LegRuleSummary> legRules,
        List<TransferRuleSummary> transferRules,
        List<NetworkSummary> networks,
        List<FareMediaSummary> fareMedia,
        List<LegJoinRuleSummary> legJoinRules
) {
    public record LegJoinRuleSummary(UUID id, String fromNetworkId, String toNetworkId,
                                      String fromStopName, String toStopName) {
        public static LegJoinRuleSummary from(FareLegJoinRule r) {
            return new LegJoinRuleSummary(
                    r.getId(),
                    r.getFromNetworkId(),
                    r.getToNetworkId(),
                    r.getFromStop() != null ? r.getFromStop().getName() : null,
                    r.getToStop() != null ? r.getToStop().getName() : null);
        }
    }

    public record NetworkSummary(UUID id, String externalId, String name, int routeCount) {
        public static NetworkSummary from(Network n) {
            return new NetworkSummary(n.getId(), n.getExternalId(), n.getName(),
                    n.getRoutes() == null ? 0 : n.getRoutes().size());
        }
    }

    public record FareMediaSummary(UUID id, String externalId, String name, Short mediaType) {
        public static FareMediaSummary from(FareMedia m) {
            return new FareMediaSummary(m.getId(), m.getExternalId(), m.getName(), m.getMediaType());
        }
    }

    public record AreaSummary(UUID id, String externalId, String name, int stopCount) {
        public static AreaSummary from(Area a) {
            return new AreaSummary(a.getId(), a.getExternalId(), a.getName(),
                    a.getStops() == null ? 0 : a.getStops().size());
        }
    }

    public record TimeframeSummary(UUID id, String timeframeGroupId,
                                   LocalTime startTime, LocalTime endTime, String serviceId) {
        public static TimeframeSummary from(Timeframe t) {
            return new TimeframeSummary(t.getId(), t.getTimeframeGroupId(),
                    t.getStartTime(), t.getEndTime(), t.getServiceId());
        }
    }

    public record ProductSummary(UUID id, String externalId, String name,
                                 String fareMediaId, BigDecimal amount, String currency) {
        public static ProductSummary from(FareProduct p) {
            return new ProductSummary(p.getId(), p.getExternalId(), p.getName(),
                    p.getFareMediaId(), p.getAmount(), p.getCurrency());
        }
    }

    public record LegRuleSummary(UUID id, String legGroupId, String networkId,
                                 String fromAreaName, String toAreaName,
                                 String fromTimeframeGroupId, String toTimeframeGroupId,
                                 String productExternalId, BigDecimal productAmount,
                                 String productCurrency, Integer rulePriority) {
        public static LegRuleSummary from(FareLegRule r) {
            FareProduct p = r.getFareProduct();
            return new LegRuleSummary(
                    r.getId(),
                    r.getLegGroupId(),
                    r.getNetworkId(),
                    r.getFromArea() != null ? r.getFromArea().getName() : null,
                    r.getToArea() != null ? r.getToArea().getName() : null,
                    r.getFromTimeframeGroupId(),
                    r.getToTimeframeGroupId(),
                    p != null ? p.getExternalId() : null,
                    p != null ? p.getAmount() : null,
                    p != null ? p.getCurrency() : null,
                    r.getRulePriority());
        }
    }

    public record TransferRuleSummary(UUID id, String fromLegGroupId, String toLegGroupId,
                                      Integer transferCount, Integer durationLimit,
                                      Short durationLimitType, Short fareTransferType,
                                      String productExternalId, BigDecimal productAmount,
                                      String productCurrency) {
        public static TransferRuleSummary from(FareTransferRule r) {
            FareProduct p = r.getFareProduct();
            return new TransferRuleSummary(
                    r.getId(),
                    r.getFromLegGroupId(),
                    r.getToLegGroupId(),
                    r.getTransferCount(),
                    r.getDurationLimit(),
                    r.getDurationLimitType(),
                    r.getFareTransferType(),
                    p != null ? p.getExternalId() : null,
                    p != null ? p.getAmount() : null,
                    p != null ? p.getCurrency() : null);
        }
    }
}
