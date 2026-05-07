package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.TranslationResponse;
import com.transit.hub.application.service.TranslationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin browse endpoint over the imported GTFS {@code translations.txt}
 * rows. Lets operators verify which {@code (table, record_id, field)}
 * triples carry localised strings for a given language before pinning
 * {@code app.translations.preferred-language} on the kiosk fleet.
 */
@RestController
@RequestMapping("/api/admin/translations")
@RequiredArgsConstructor
@Tag(name = "Administration — traductions",
     description = "Browse des traductions GTFS importées (translations.txt).")
public class TranslationController {

    private final TranslationService translationService;

    @GetMapping
    public ResponseEntity<List<TranslationResponse>> browse(
            @RequestParam("lang") String language,
            @RequestParam(name = "table", required = false) String tableName) {
        return ResponseEntity.ok(translationService.browse(language, tableName));
    }
}
