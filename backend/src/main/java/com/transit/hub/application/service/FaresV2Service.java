package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.FaresV2Response;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.FareLegJoinRuleRepository;
import com.transit.hub.infrastructure.persistence.FareLegRuleRepository;
import com.transit.hub.infrastructure.persistence.FareMediaRepository;
import com.transit.hub.infrastructure.persistence.FareProductRepository;
import com.transit.hub.infrastructure.persistence.FareTransferRuleRepository;
import com.transit.hub.infrastructure.persistence.NetworkRepository;
import com.transit.hub.infrastructure.persistence.TimeframeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class FaresV2Service {

    private final AreaRepository areaRepository;
    private final TimeframeRepository timeframeRepository;
    private final FareProductRepository fareProductRepository;
    private final FareLegRuleRepository fareLegRuleRepository;
    private final FareTransferRuleRepository fareTransferRuleRepository;
    private final NetworkRepository networkRepository;
    private final FareMediaRepository fareMediaRepository;
    private final FareLegJoinRuleRepository fareLegJoinRuleRepository;

    @Transactional(readOnly = true)
    public FaresV2Response browse() {
        return new FaresV2Response(
                areaRepository.findAllWithStops().stream()
                        .map(FaresV2Response.AreaSummary::from)
                        .toList(),
                timeframeRepository.findAll().stream()
                        .map(FaresV2Response.TimeframeSummary::from)
                        .toList(),
                fareProductRepository.findAll().stream()
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
                fareMediaRepository.findAll().stream()
                        .map(FaresV2Response.FareMediaSummary::from)
                        .toList(),
                fareLegJoinRuleRepository.findAllWithStops().stream()
                        .map(FaresV2Response.LegJoinRuleSummary::from)
                        .toList()
        );
    }
}
