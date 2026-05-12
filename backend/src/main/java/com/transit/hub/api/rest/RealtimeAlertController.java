package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.RealtimeAlertResponse;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/**
 * Admin endpoint to inspect the GTFS-Realtime alerts cache and force
 * a refresh on demand. Useful when the operator just published a new
 * alert and wants to verify it's visible without waiting for the
 * next polling tick.
 */
@RestController
@RequestMapping("/api/admin/realtime/alerts")
@RequiredArgsConstructor
@Tag(name = "Administration — temps réel",
     description = "Cache des alertes GTFS-Realtime et déclencheur de rafraîchissement.")
public class RealtimeAlertController {

    private final RealtimeAlertCache alertCache;

    @GetMapping
    @Operation(summary = "Liste les alertes GTFS-RT actives",
               description = "Renvoie le snapshot courant filtré par les alertes encore "
                       + "dans leur fenêtre temporelle.")
    public ResponseEntity<List<RealtimeAlertResponse>> active() {
        List<RealtimeAlertResponse> alerts = alertCache.activeAlerts(Instant.now()).stream()
                .map(RealtimeAlertController::toResponse)
                .toList();
        return ResponseEntity.ok(alerts);
    }

    private static RealtimeAlertResponse toResponse(RealtimeAlertCache.AlertSnapshot snap) {
        return new RealtimeAlertResponse(
                snap.id(),
                List.copyOf(snap.routeExternalIds()),
                List.copyOf(snap.stopExternalIds()),
                List.copyOf(snap.agencyExternalIds()),
                snap.headerText(),
                snap.descriptionText(),
                snap.url(),
                snap.cause() != null ? snap.cause().name() : null,
                snap.effect() != null ? snap.effect().name() : null,
                snap.severity() != null ? snap.severity().name() : null
        );
    }

    @PostMapping("/refresh")
    @Operation(summary = "Force un rafraîchissement du flux GTFS-RT",
               description = "Repolle l'URL configurée par app.gtfs-rt.alerts-url. Synchrone : "
                       + "renvoie la liste mise à jour si le fetch a réussi.")
    public ResponseEntity<List<RealtimeAlertResponse>> refresh() {
        if (!alertCache.isEnabled()) {
            return ResponseEntity.badRequest().body(List.of());
        }
        alertCache.refresh();
        return active();
    }
}
