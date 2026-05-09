package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.LocationResponse;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;

    @Transactional(readOnly = true)
    public List<LocationResponse> browse() {
        return locationRepository.findAllOrdered().stream()
                .map(LocationResponse::from)
                .toList();
    }
}
