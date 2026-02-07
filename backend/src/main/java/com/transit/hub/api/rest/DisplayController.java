package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.DeviceAuthResponse;
import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.dto.response.HubDisplayState;
import com.transit.hub.application.service.DeviceService;
import com.transit.hub.application.service.DisplayStateService;
import com.transit.hub.application.service.HubDisplayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/display")
@RequiredArgsConstructor
public class DisplayController {

    private final DisplayStateService displayStateService;
    private final DeviceService deviceService;
    private final HubDisplayService hubDisplayService;

    @GetMapping("/hub")
    public ResponseEntity<HubDisplayState> getHubDisplayState(
            @RequestParam List<UUID> stopIds,
            @RequestParam(defaultValue = "Hub") String name) {
        if (stopIds.isEmpty() || stopIds.size() > 10) {
            return ResponseEntity.badRequest().build();
        }
        return ResponseEntity.ok(hubDisplayService.getHubDisplayState(stopIds, name));
    }

    @GetMapping("/{stopId}")
    public ResponseEntity<DisplayState> getDisplayState(@PathVariable UUID stopId) {
        return ResponseEntity.ok(displayStateService.getDisplayState(stopId));
    }

    @GetMapping
    public ResponseEntity<DisplayState> getDisplayStateByToken(
            @RequestHeader("X-Device-Token") String token) {
        DeviceAuthResponse auth = deviceService.authenticateDevice(token);
        if (!auth.valid()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(displayStateService.getDisplayState(auth.stopId()));
    }
}
