package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.ImportAuditResponse;
import com.transit.hub.application.service.ImportAuditService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin timeline of GTFS import attempts. Capped to 200 rows per call so
 * an excited query string can't blow up the response.
 */
@RestController
@RequestMapping("/api/admin/import-audit")
@RequiredArgsConstructor
public class ImportAuditController {

    private final ImportAuditService importAuditService;

    @GetMapping
    public ResponseEntity<List<ImportAuditResponse>> getRecent(
            @RequestParam(name = "limit", required = false) Integer limit) {
        return ResponseEntity.ok(importAuditService.getRecent(limit));
    }
}
