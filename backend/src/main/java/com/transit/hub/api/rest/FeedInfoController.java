package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.FeedInfoResponse;
import com.transit.hub.application.service.FeedInfoService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Exposes provenance metadata for the loaded GTFS feed (publisher, validity
 * window, source URL, last import timestamp). Used by the admin dashboard
 * to surface a "feed expired" warning when the declared validity window
 * is about to lapse.
 * <p>
 * Locked to {@code ROLE_ADMIN} via the {@code /api/admin/**} blanket rule
 * in {@code SecurityConfig}.
 */
@RestController
@RequestMapping("/api/admin/feed-info")
@RequiredArgsConstructor
@Tag(name = "Administration — feed GTFS",
     description = "Métadonnées et statistiques d'import du feed GTFS chargé.")
public class FeedInfoController {

    private final FeedInfoService feedInfoService;

    @GetMapping
    public ResponseEntity<FeedInfoResponse> getFeedInfo() {
        return feedInfoService.getFeedInfo()
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }
}
