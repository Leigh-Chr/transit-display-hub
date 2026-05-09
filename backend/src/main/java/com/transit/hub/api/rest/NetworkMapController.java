package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.LocationResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.service.LocationService;
import com.transit.hub.application.service.NetworkMapService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/network-map")
@RequiredArgsConstructor
@Tag(name = "Carte réseau",
     description = "Carte schématique publique et alertes attachées au réseau.")
public class NetworkMapController {

    private final NetworkMapService networkMapService;
    private final LocationService locationService;

    @GetMapping
    public ResponseEntity<NetworkMapResponse> getNetworkMap() {
        return ResponseEntity.ok(networkMapService.getNetworkMap());
    }

    @GetMapping("/alerts")
    public ResponseEntity<AlertsResponse> getAlerts() {
        return ResponseEntity.ok(networkMapService.getAlerts());
    }

    /**
     * Public endpoint serving the GTFS-flex zone polygon attached to a
     * stop. Returns 404 when the stop has no flex location bound to it
     * — the stop-popup keys the request on {@code Stop.hasOnDemand}
     * but the spec allows on-demand pickups without an explicit zone
     * polygon, so a "no zone here" answer is normal.
     */
    @GetMapping("/stops/{stopId}/tad-zone")
    public ResponseEntity<LocationResponse> getStopTadZone(@PathVariable UUID stopId) {
        return locationService.findByStop(stopId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
