package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.ImportAuditResponse;
import com.transit.hub.application.service.ImportAuditService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

/**
 * Admin timeline of GTFS import attempts. Capped to 200 rows per call so
 * an excited query string can't blow up the response. Two extra endpoints
 * serve the MobilityData validator report files (JSON and HTML) the
 * orchestrator wrote on disk during the matching import.
 */
@RestController
@RequestMapping("/api/admin/import-audit")
@RequiredArgsConstructor
@Tag(name = "Administration — feed GTFS",
     description = "Journal des tentatives d'import GTFS (succès, skip, échec).")
public class ImportAuditController {

    private final ImportAuditService importAuditService;

    @GetMapping
    public ResponseEntity<List<ImportAuditResponse>> getRecent(
            @RequestParam(name = "limit", required = false) Integer limit) {
        return ResponseEntity.ok(importAuditService.getRecent(limit));
    }

    @GetMapping("/{id}/validation-report")
    public ResponseEntity<byte[]> getValidationReportJson(@PathVariable UUID id) throws IOException {
        return importAuditService.readValidationReport(id, "report.json")
                .map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(bytes))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/{id}/validation-report.html")
    public ResponseEntity<byte[]> getValidationReportHtml(@PathVariable UUID id) throws IOException {
        // The validator's HTML is rendered from feed-supplied strings (agency
        // names, route long names, etc.). The CSP sandbox directive renders
        // it inert in the admin browser: scripts can't run, requests can't
        // fire, no top-level navigation. Styles stay inline for readability.
        return importAuditService.readValidationReport(id, "report.html")
                .map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.TEXT_HTML)
                        .header("Content-Security-Policy",
                                "sandbox; default-src 'none'; "
                                        + "style-src 'unsafe-inline'; "
                                        + "img-src 'self' data:")
                        .header("X-Content-Type-Options", "nosniff")
                        .body(bytes))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
