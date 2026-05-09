package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.LocationResponse;
import com.transit.hub.domain.util.PolygonContains;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LocationService {

    private final LocationRepository locationRepository;
    private final StopRepository stopRepository;

    @Transactional(readOnly = true)
    public List<LocationResponse> browse() {
        return locationRepository.findAllOrdered().stream()
                .map(LocationResponse::from)
                .toList();
    }

    /**
     * Find the GTFS-flex zone polygon attached to a stop, by joining
     * {@code Stop.externalId} against {@code Location.stopExternalId}.
     * Returns the first match — feeds rarely publish more than one zone
     * per flexible stop, but the spec doesn't forbid it. The
     * stop-popup uses this to lazy-load the polygon only for stops that
     * actually have one (gated by {@code Stop.hasOnDemand} on the
     * client side, so the round-trip is cheap to skip).
     */
    @Transactional(readOnly = true)
    public Optional<LocationResponse> findByStop(UUID stopId) {
        return stopRepository.findById(stopId)
                .map(stop -> stop.getExternalId())
                .filter(extId -> extId != null && !extId.isBlank())
                .flatMap(extId -> {
                    var matches = locationRepository.findByStopExternalId(extId);
                    return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
                })
                .map(LocationResponse::from);
    }

    /**
     * Returns every flex location whose polygon contains the input
     * point. Two-step: a SQL bounding-box pre-filter on the indexed
     * min/max columns narrows the candidate set, then a Java
     * ray-casting pass on the GeoJSON geometry confirms the actual
     * containment. Keeps ADR 0026 intact — no JTS, no PostGIS, no
     * spatial column.
     */
    @Transactional(readOnly = true)
    public List<LocationResponse> findContainingPoint(double latitude, double longitude) {
        return locationRepository.findByBoundingBoxContaining(latitude, longitude).stream()
                .filter(loc -> PolygonContains.contains(loc.getGeometryJson(), latitude, longitude))
                .map(LocationResponse::from)
                .toList();
    }
}
