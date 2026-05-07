package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.FareAttributeResponse;
import com.transit.hub.application.service.FareService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin browse endpoint over the imported GTFS Fares v1 rows. Surfaces
 * every {@link com.transit.hub.domain.model.FareAttribute} with its
 * applicability {@link com.transit.hub.domain.model.FareRule rules}
 * inline. Read-only; admin role gated via {@code SecurityConfig}'s
 * {@code /api/admin/**} pattern.
 */
@RestController
@RequestMapping("/api/admin/fares")
@RequiredArgsConstructor
@Tag(name = "Administration — tarifs",
     description = "Browse des tarifs GTFS Fares v1 (fare_attributes + fare_rules).")
public class FareController {

    private final FareService fareService;

    @GetMapping
    public ResponseEntity<List<FareAttributeResponse>> browse() {
        return ResponseEntity.ok(fareService.browse());
    }
}
