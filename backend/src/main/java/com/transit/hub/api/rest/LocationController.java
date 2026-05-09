package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.LocationResponse;
import com.transit.hub.application.service.LocationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin browse over the imported GTFS-flex {@code locations.geojson}
 * polygons. Read-only; admin role gated via the {@code /api/admin/**}
 * blanket rule in {@code SecurityConfig}.
 */
@RestController
@RequestMapping("/api/admin/locations")
@RequiredArgsConstructor
@Tag(name = "Administration — TAD",
     description = "Polygones GTFS-flex (locations.geojson) — zones de prise en charge / dépose flexibles.")
public class LocationController {

    private final LocationService locationService;

    @GetMapping
    public ResponseEntity<List<LocationResponse>> browse() {
        return ResponseEntity.ok(locationService.browse());
    }
}
