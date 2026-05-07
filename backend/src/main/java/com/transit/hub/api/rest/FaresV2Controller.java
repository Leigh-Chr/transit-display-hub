package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.FaresV2Response;
import com.transit.hub.application.service.FaresV2Service;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Aggregate browse endpoint over GTFS Fares v2 — areas, timeframes,
 * fare products, leg rules and transfer rules. Single round-trip
 * payload because the v2 model is small (a few hundred rows tops on
 * a typical feed) and the relations are useless when split.
 *
 * Coexists with /api/admin/fares which serves Fares v1; admins can
 * inspect both versions side by side.
 */
@RestController
@RequestMapping("/api/admin/fares-v2")
@RequiredArgsConstructor
@Tag(name = "Administration — tarifs",
     description = "Browse des tarifs GTFS Fares v2 (areas, timeframes, products, leg/transfer rules).")
public class FaresV2Controller {

    private final FaresV2Service faresV2Service;

    @GetMapping
    public ResponseEntity<FaresV2Response> browse() {
        return ResponseEntity.ok(faresV2Service.browse());
    }
}
