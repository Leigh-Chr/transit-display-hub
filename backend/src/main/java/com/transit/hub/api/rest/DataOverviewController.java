package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.DataOverviewResponse;
import com.transit.hub.application.service.DataOverviewService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Single-call snapshot of every persisted entity count plus the
 * realtime cache sizes. Lets the admin dashboard render a
 * "what does this install have?" panel without firing twenty
 * separate counts.
 */
@RestController
@RequestMapping("/api/admin/data-overview")
@RequiredArgsConstructor
@Tag(name = "Administration — diagnostic",
     description = "Aperçu agrégé des entités persistées et de l'état des caches RT.")
public class DataOverviewController {

    private final DataOverviewService overviewService;

    @GetMapping
    @Operation(summary = "Compteurs agrégés et état des caches RT",
               description = "Renvoie en une seule réponse les counts de chaque table GTFS "
                       + "ainsi que la taille courante des trois caches GTFS-RT.")
    public ResponseEntity<DataOverviewResponse> current() {
        return ResponseEntity.ok(overviewService.current());
    }
}
