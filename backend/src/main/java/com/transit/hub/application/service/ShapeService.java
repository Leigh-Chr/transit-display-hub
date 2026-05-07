package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.ShapeResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Shape;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.ShapeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ShapeService {

    private final ItineraryRepository itineraryRepository;
    private final ShapeRepository shapeRepository;

    /**
     * Resolves the shape attached to an itinerary. Returns
     * {@link Optional#empty()} when the itinerary exists but the feed
     * didn't ship a {@code shape_id} for its representative trip — in
     * that case the caller should fall back to the stop-to-stop
     * polyline derived from {@code itinerary_stops}.
     *
     * @throws EntityNotFoundException when the itinerary doesn't exist.
     */
    @Transactional(readOnly = true)
    public Optional<ShapeResponse> findByItinerary(UUID itineraryId) {
        Itinerary itinerary = itineraryRepository.findById(itineraryId)
                .orElseThrow(() -> new EntityNotFoundException("Itinerary", itineraryId));
        Shape lazyShape = itinerary.getShape();
        if (lazyShape == null) {
            return Optional.empty();
        }
        // Re-fetch with the points eager so the response carries the
        // polyline without an N+1 lazy-load.
        return shapeRepository.findByIdWithPoints(lazyShape.getId())
                .map(ShapeResponse::from);
    }
}
