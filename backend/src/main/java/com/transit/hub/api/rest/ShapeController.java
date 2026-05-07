package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.ShapeResponse;
import com.transit.hub.application.service.ShapeService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Geographic polyline of an itinerary, sourced from GTFS
 * {@code shapes.txt}. Public read-only — same auth tier as the rest
 * of {@code /api/itineraries/**} GETs (the schedule dialog and the
 * future map view need it without a login).
 * <p>
 * Returns 404 when the itinerary doesn't exist, 204 when it exists
 * but the feed shipped no shape for it (caller falls back to the
 * stop-to-stop polyline).
 */
@RestController
@RequestMapping("/api/itineraries/{itineraryId}/shape")
@RequiredArgsConstructor
@Tag(name = "Données GTFS — shapes",
     description = "Polyline géographique d'un itinéraire issue de shapes.txt.")
public class ShapeController {

    private final ShapeService shapeService;

    @GetMapping
    public ResponseEntity<ShapeResponse> getShapeForItinerary(@PathVariable UUID itineraryId) {
        return shapeService.findByItinerary(itineraryId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
