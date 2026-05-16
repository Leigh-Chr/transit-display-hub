package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.RealtimeAlertResponse;
import com.transit.hub.application.service.RealtimeAdminService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin endpoint to inspect the GTFS-Realtime alerts cache and force
 * a refresh on demand. The controller stays a thin HTTP adapter over
 * {@link RealtimeAdminService}; cache state lives in infrastructure.
 */
@RestController
@RequestMapping("/api/admin/realtime/alerts")
@RequiredArgsConstructor
@Tag(name = "Administration — temps réel",
     description = "Cache des alertes GTFS-Realtime et déclencheur de rafraîchissement.")
public class RealtimeAlertController {

    private final RealtimeAdminService realtimeAdmin;

    @GetMapping
    @Operation(summary = "Liste les alertes GTFS-RT actives",
               description = "Renvoie le snapshot courant filtré par les alertes encore "
                       + "dans leur fenêtre temporelle.")
    public ResponseEntity<List<RealtimeAlertResponse>> active() {
        return ResponseEntity.ok(realtimeAdmin.activeAlerts());
    }

    @PostMapping("/refresh")
    @Operation(summary = "Force un rafraîchissement du flux GTFS-RT",
               description = "Repolle l'URL configurée par app.gtfs-rt.alerts-url. Synchrone : "
                       + "renvoie la liste mise à jour si le fetch a réussi.")
    public ResponseEntity<List<RealtimeAlertResponse>> refresh() {
        return realtimeAdmin.refreshAlerts()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.badRequest().body(List.of()));
    }
}
