package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.service.DisplayStateService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/display")
@RequiredArgsConstructor
public class DisplayController {

    private final DisplayStateService displayStateService;

    @GetMapping("/{stopId}")
    public ResponseEntity<DisplayState> getDisplayState(@PathVariable UUID stopId) {
        return ResponseEntity.ok(displayStateService.getDisplayState(stopId));
    }
}
