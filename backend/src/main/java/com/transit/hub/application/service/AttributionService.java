package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.AttributionResponse;
import com.transit.hub.infrastructure.persistence.AttributionRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AttributionService {

    private final AttributionRepository attributionRepository;

    @Transactional(readOnly = true)
    public List<AttributionResponse> getAllAttributions() {
        return attributionRepository.findAll().stream()
                .sorted(Comparator
                        // producers first (they own the data), then operators,
                        // then authorities — matches the conventional order
                        // for transit credit blocks.
                        .comparing((com.transit.hub.domain.model.Attribution a) -> !a.isProducer())
                        .thenComparing(a -> !a.isOperator())
                        .thenComparing(a -> a.getOrganizationName() == null ? "" : a.getOrganizationName()))
                .map(AttributionResponse::from)
                .toList();
    }
}
