package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.FlexStopTimeResponse;
import com.transit.hub.application.service.FlexAvailabilityService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Admin browse endpoint over the GTFS-flex stop_times — the on-demand
 * counterpart of {@code schedules}. Lists every persisted flex window
 * with its target ({@code stop_id}, {@code location_id} or
 * {@code location_group_id}) and the booking rules attached.
 *
 * Empty on every feed that doesn't ship flex data; Grenoble's M Réso
 * is one such feed. The page itself stays useful because it documents
 * the shape the project supports for operators evaluating GTFS-flex
 * feeds.
 */
@RestController
@RequestMapping("/api/admin/flex-stop-times")
@RequiredArgsConstructor
@Tag(name = "Administration — TAD",
     description = "Stop_times à la demande (windows + targets + booking rules).")
public class FlexStopTimeController {

    private final FlexAvailabilityService flexAvailabilityService;

    @GetMapping
    public ResponseEntity<List<FlexStopTimeResponse>> browse() {
        return ResponseEntity.ok(flexAvailabilityService.browse());
    }
}
