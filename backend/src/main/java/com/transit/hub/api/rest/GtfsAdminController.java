package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.ImportAuditResponse;
import com.transit.hub.application.service.GtfsImportOrchestrator;
import com.transit.hub.application.service.ImportAuditService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.URI;
import java.util.UUID;

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
    private final ImportAuditService importAuditService;

    @Value("${app.data-loader.gtfs.url:}")
    private String feedUrl;

    @PostMapping("/reimport")
    @Operation(summary = "Force un réimport GTFS",
               description = "Asynchrone : enregistre une ligne d'audit RUNNING, "
                       + "déclenche le téléchargement + import en tâche de fond "
                       + "et retourne 202 Accepted avec un en-tête Location pointant "
                       + "vers la ligne d'audit pour suivre l'avancement. "
                       + "Renvoie 409 si un import est déjà en cours.")
    public ResponseEntity<Void> reimport(Authentication authentication) {
        if (feedUrl == null || feedUrl.isBlank()) {
            // Same semantics as before — pas de feed configuré = 400 Bad Request.
            // On expose un Location nul plutôt qu'un body verbeux pour rester
            // cohérent avec le contrat 202/Void choisi pour l'happy path.
            return ResponseEntity.badRequest().build();
        }
        String triggeredBy = authentication != null ? authentication.getName() : "admin";
        log.info("Manual GTFS refresh triggered by {}", triggeredBy);
        UUID importId = orchestrator.runImportAsync(feedUrl, triggeredBy);
        URI location = URI.create("/api/admin/gtfs/imports/" + importId);
        return ResponseEntity.accepted().location(location).build();
    }

    @GetMapping("/imports/{id}")
    @Operation(summary = "Lecture d'un audit d'import",
               description = "Renvoie l'état d'un import GTFS déclenché via /reimport "
                       + "(RUNNING, SUCCESS, FAILED, SKIPPED). 404 si l'identifiant "
                       + "ne correspond à aucun audit. Sert de companion à l'en-tête "
                       + "Location du 202 Accepted.")
    public ResponseEntity<ImportAuditResponse> getImport(@PathVariable UUID id) {
        return importAuditService.getById(id)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
