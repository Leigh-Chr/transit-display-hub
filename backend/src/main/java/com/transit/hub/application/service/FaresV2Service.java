package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.FaresV2Response;
import com.transit.hub.application.support.UnpaginatedCap;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.FareLegJoinRuleRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.FareMediaRepository;
import com.transit.hub.infrastructure.persistence.FareProductRepository;
import com.transit.hub.infrastructure.persistence.FareTransferRuleRepository;
import com.transit.hub.infrastructure.persistence.NetworkRepository;
import com.transit.hub.infrastructure.persistence.RiderCategoryRepository;
import com.transit.hub.infrastructure.persistence.TimeframeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class FaresV2Service {

    private final AreaRepository areaRepository;
    private final TimeframeRepository timeframeRepository;
    private final FareProductRepository fareProductRepository;
    private final FareLegRuleRepository fareLegRuleRepository;
    private final FareTransferRuleRepository fareTransferRuleRepository;
    private final NetworkRepository networkRepository;
    private final FareMediaRepository fareMediaRepository;
    private final FareLegJoinRuleRepository fareLegJoinRuleRepository;
    private final RiderCategoryRepository riderCategoryRepository;

    @Transactional(readOnly = true)
    public FaresV2Response browse() {
        // Each repository read here is GTFS-bounded (fares v2 ships
        // typically tens of rows per type) but we still cap them so a
        // pathological feed can't blow the heap. The two repositories
        // that already expose targeted JOIN-FETCH variants
        // (areaRepository.findAllWithStops, etc.) stay as-is — they
        // are the read-optimised path and the cap would defeat the
        // join fetch.
        return new FaresV2Response(
                areaRepository.findAllWithStops().stream()
                        .map(FaresV2Response.AreaSummary::from)
                        .toList(),
                UnpaginatedCap.findAllCapped(timeframeRepository, log, "FaresV2Service.browse#timeframes")
                        .stream()
                        .map(FaresV2Response.TimeframeSummary::from)
                        .toList(),
                UnpaginatedCap.findAllCapped(fareProductRepository, log, "FaresV2Service.browse#fareProducts")
                        .stream()
                        .map(FaresV2Response.ProductSummary::from)
                        .toList(),
                fareLegRuleRepository.findAllWithRefs().stream()
                        .map(FaresV2Response.LegRuleSummary::from)
                        .toList(),
                fareTransferRuleRepository.findAllWithProduct().stream()
                        .map(FaresV2Response.TransferRuleSummary::from)
                        .toList(),
                networkRepository.findAllWithRoutes().stream()
                        .map(FaresV2Response.NetworkSummary::from)
                        .toList(),
                UnpaginatedCap.findAllCapped(fareMediaRepository, log, "FaresV2Service.browse#fareMedia")
                        .stream()
                        .map(FaresV2Response.FareMediaSummary::from)
                        .toList(),
                fareLegJoinRuleRepository.findAllWithStops().stream()
                        .map(FaresV2Response.LegJoinRuleSummary::from)
                        .toList(),
                UnpaginatedCap.findAllCapped(riderCategoryRepository, log, "FaresV2Service.browse#riderCategories")
                        .stream()
                        .map(FaresV2Response.RiderCategorySummary::from)
                        .toList()
        );
    }
}
