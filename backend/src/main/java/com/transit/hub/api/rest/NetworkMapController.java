package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.service.NetworkMapService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/network-map")
@RequiredArgsConstructor
@Tag(name = "Carte réseau",
     description = "Carte schématique publique et alertes attachées au réseau.")
public class NetworkMapController {

    private final NetworkMapService networkMapService;

    @GetMapping
    public ResponseEntity<NetworkMapResponse> getNetworkMap() {
        return ResponseEntity.ok(networkMapService.getNetworkMap());
    }

    @GetMapping("/alerts")
    public ResponseEntity<AlertsResponse> getAlerts() {
        return ResponseEntity.ok(networkMapService.getAlerts());
    }
}
