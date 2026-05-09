package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.FareCalculationResponse;
import com.transit.hub.application.service.FareCalculatorService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * Public fare calculator endpoint. Resolves the GTFS fares applicable
 * for a trip between two stops by consulting both V1
 * ({@code fare_attributes} + {@code fare_rules}) and V2
 * ({@code fare_leg_rules} + {@code areas}) tables. Returns 404 when
 * either stop id is unknown.
 *
 * Public for the same reason {@code /api/network-map} is: a passenger
 * surface needs to ask "combien coûte mon trajet ?" without
 * authenticating.
 */
@RestController
@RequestMapping("/api/fares")
@RequiredArgsConstructor
@Tag(name = "Tarification",
     description = "Calcul tarifaire public à partir des fares V1 + V2.")
public class FareCalculatorController {

    private final FareCalculatorService fareCalculatorService;

    @GetMapping("/calculate")
    public ResponseEntity<FareCalculationResponse> calculate(
            @RequestParam("from") UUID fromStopId,
            @RequestParam("to") UUID toStopId) {
        return fareCalculatorService.calculate(fromStopId, toStopId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
