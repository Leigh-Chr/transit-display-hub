package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.VehiclePositionResponse;
import com.transit.hub.infrastructure.realtime.RealtimeVehiclePositionCache;
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
 * Admin endpoint for browsing the live GTFS-Realtime vehicle
 * positions cache. No passenger surface yet — kiosks don't render a
 * map; this endpoint exists for ops dashboards and integration
 * testing.
 */
@RestController
@RequestMapping("/api/admin/realtime/vehicles")
@RequiredArgsConstructor
@Tag(name = "Administration — temps réel",
     description = "Snapshot des positions véhicules GTFS-Realtime.")
public class RealtimeVehicleController {

    private final RealtimeVehiclePositionCache cache;

    @GetMapping
    @Operation(summary = "Liste les positions véhicules courantes",
               description = "Renvoie le dernier snapshot connu, ordonné par route puis "
                       + "vehicle_id. La fraîcheur dépend de "
                       + "app.gtfs-rt.vehicle-positions-poll-cron.")
    public ResponseEntity<List<VehiclePositionResponse>> current() {
        List<VehiclePositionResponse> positions = cache.currentSnapshot().stream()
                .map(RealtimeVehicleController::toResponse)
                .toList();
        return ResponseEntity.ok(positions);
    }

    private static VehiclePositionResponse toResponse(RealtimeVehiclePositionCache.VehicleSnapshot snap) {
        return new VehiclePositionResponse(
                snap.entityId(),
                snap.vehicleId(),
                snap.vehicleLabel(),
                snap.tripId(),
                snap.routeId(),
                snap.latitude(),
                snap.longitude(),
                snap.bearing(),
                snap.speed(),
                snap.currentStatus(),
                snap.currentStopId(),
                snap.currentStopSequence(),
                snap.congestionLevel(),
                snap.occupancyStatus(),
                snap.occupancyPercentage(),
                snap.timestampEpochSeconds()
        );
    }

    @PostMapping("/refresh")
    @Operation(summary = "Force un rafraîchissement immédiat",
               description = "Repolle l'URL configurée par "
                       + "app.gtfs-rt.vehicle-positions-url. Synchrone.")
    public ResponseEntity<List<VehiclePositionResponse>> refresh() {
        if (!cache.isEnabled()) {
            return ResponseEntity.badRequest().body(List.of());
        }
        cache.refresh();
        return current();
    }
}
