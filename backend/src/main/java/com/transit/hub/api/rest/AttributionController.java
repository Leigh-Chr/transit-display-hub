package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.AttributionResponse;
import com.transit.hub.application.service.AttributionService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Public credit block (data producer / operator / authority) for the
 * loaded GTFS feed. Reachable to anyone — the network map's footer
 * needs it both for authenticated admins and anonymous kiosks.
 */
@RestController
@RequestMapping("/api/attributions")
@RequiredArgsConstructor
@Tag(name = "Information publique",
     description = "Crédits du producteur / opérateur / autorité du feed GTFS.")
public class AttributionController {

    private final AttributionService attributionService;

    @GetMapping
    public ResponseEntity<List<AttributionResponse>> getAllAttributions() {
        return ResponseEntity.ok(attributionService.getAllAttributions());
    }
}
