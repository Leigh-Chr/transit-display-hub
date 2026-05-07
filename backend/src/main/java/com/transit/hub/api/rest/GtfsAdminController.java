package com.transit.hub.api.rest;

import com.transit.hub.application.service.GtfsImportOrchestrator;
import com.transit.hub.domain.model.enums.ImportStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Admin endpoint to force a GTFS refresh on demand. Mirrors the cron
 * scheduler but exposes the import orchestrator behind a manual trigger
 * (useful when an agency publishes an emergency update mid-day or when
 * an admin just verified a feed fix and doesn't want to wait).
 */
@RestController
@RequestMapping("/api/admin/gtfs")
@RequiredArgsConstructor
@Slf4j
@Tag(name = "Administration — feed GTFS",
     description = "Déclenchement manuel d'un import GTFS et journal d'activité.")
public class GtfsAdminController {

    private final GtfsImportOrchestrator orchestrator;

    @Value("${app.data-loader.gtfs.url:}")
    private String feedUrl;

    @PostMapping("/reimport")
    @Operation(summary = "Force un réimport GTFS",
               description = "Synchrone : télécharge le feed (avec cache If-Modified-Since), "
                       + "calcule le SHA-256, importe si modifié, et écrit une ligne d'audit. "
                       + "Identifie l'utilisateur via l'identité authentifiée pour la traçabilité.")
    public ResponseEntity<RefreshResponse> reimport(Authentication authentication) {
        if (feedUrl == null || feedUrl.isBlank()) {
            return ResponseEntity.badRequest()
                    .body(new RefreshResponse(null, null, "No GTFS URL configured"));
        }
        String triggeredBy = authentication != null ? authentication.getName() : "admin";
        log.info("Manual GTFS refresh triggered by {}", triggeredBy);
        GtfsImportOrchestrator.ImportOutcome outcome = orchestrator.runImport(feedUrl, triggeredBy);
        Integer scheduleCount = outcome.result() != null ? outcome.result().schedules() : null;
        return ResponseEntity.ok(new RefreshResponse(
                outcome.status(),
                scheduleCount,
                outcome.message()
        ));
    }

    public record RefreshResponse(ImportStatus status, Integer schedulesCount, String message) {}
}
