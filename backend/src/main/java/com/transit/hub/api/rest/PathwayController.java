package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.PathwayResponse;
import com.transit.hub.application.service.PathwayService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Exposes the GTFS {@code pathways.txt} topology around a given stop.
 * Available to any authenticated user — admins and agents can both
 * inspect a station's indoor connectivity (escalators, lifts,
 * traversal times) for accessibility audits and signage planning.
 */
@RestController
@RequestMapping("/api/stops/{stopId}/pathways")
@RequiredArgsConstructor
@Tag(name = "Données GTFS — pathways",
     description = "Topologie indoor d'une station (escaliers, ascenseurs, sorties).")
public class PathwayController {

    private final PathwayService pathwayService;

    @GetMapping
    public ResponseEntity<List<PathwayResponse>> getPathwaysForStop(@PathVariable UUID stopId) {
        return ResponseEntity.ok(pathwayService.findPathwaysForStop(stopId));
    }
}
