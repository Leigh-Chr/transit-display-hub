package com.transit.hub.api.rest;

import com.transit.hub.application.dto.request.CreateStopRequest;
import com.transit.hub.application.dto.response.StopResponse;
import com.transit.hub.application.service.StopService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/stops")
@RequiredArgsConstructor
public class StopController {

    private final StopService stopService;

    @GetMapping
    public ResponseEntity<List<StopResponse>> getAllStops(@RequestParam(required = false) UUID lineId) {
        if (lineId != null) {
            return ResponseEntity.ok(stopService.getStopsByLine(lineId));
        }
        return ResponseEntity.ok(stopService.getAllStops());
    }

    @GetMapping("/{id}")
    public ResponseEntity<StopResponse> getStop(@PathVariable UUID id) {
        return ResponseEntity.ok(stopService.getStop(id));
    }

    @PostMapping
    public ResponseEntity<StopResponse> createStop(@Valid @RequestBody CreateStopRequest request) {
        StopResponse created = stopService.createStop(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<StopResponse> updateStop(@PathVariable UUID id, @Valid @RequestBody CreateStopRequest request) {
        return ResponseEntity.ok(stopService.updateStop(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteStop(@PathVariable UUID id) {
        stopService.deleteStop(id);
        return ResponseEntity.noContent().build();
    }
}
