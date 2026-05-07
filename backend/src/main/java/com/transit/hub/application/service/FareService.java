package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.FareAttributeResponse;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class FareService {

    private final FareAttributeRepository fareAttributeRepository;

    /** Returns every fare attribute (with its rules) sorted by price
     *  ascending so admins see the cheapest tickets first. Tiebreak by
     *  external id for stable ordering. */
    @Transactional(readOnly = true)
    public List<FareAttributeResponse> browse() {
        return fareAttributeRepository.findAllWithRules().stream()
                .sorted(Comparator
                        .comparing(com.transit.hub.domain.model.FareAttribute::getPrice)
                        .thenComparing(com.transit.hub.domain.model.FareAttribute::getExternalId))
                .map(FareAttributeResponse::from)
                .toList();
    }
}
