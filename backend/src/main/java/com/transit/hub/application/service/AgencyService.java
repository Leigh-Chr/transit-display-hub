package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.AgencyResponse;
import com.transit.hub.infrastructure.persistence.AgencyRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AgencyService {

    private final AgencyRepository agencyRepository;

    @Transactional(readOnly = true)
    public List<AgencyResponse> getAllAgencies() {
        return agencyRepository.findAll().stream()
                .sorted(Comparator.comparing(a -> a.getName() == null ? "" : a.getName()))
                .map(AgencyResponse::from)
                .toList();
    }
}
