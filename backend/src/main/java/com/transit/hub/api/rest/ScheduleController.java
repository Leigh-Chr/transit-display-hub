package com.transit.hub.api.rest;

import com.transit.hub.application.dto.request.CreateTimedEntryRequest;
import com.transit.hub.application.dto.response.TimedEntryResponse;
import com.transit.hub.application.service.ScheduleService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class ScheduleController {

    private final ScheduleService scheduleService;

    @GetMapping("/stops/{stopId}/schedules")
    public ResponseEntity<List<TimedEntryResponse>> getScheduleForStop(@PathVariable UUID stopId) {
        return ResponseEntity.ok(scheduleService.getScheduleForStop(stopId));
    }

    @PostMapping("/stops/{stopId}/schedules")
    public ResponseEntity<TimedEntryResponse> createTimedEntry(
            @PathVariable UUID stopId,
            @Valid @RequestBody CreateTimedEntryRequest request
    ) {
        TimedEntryResponse created = scheduleService.createTimedEntry(stopId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/schedules/{id}")
    public ResponseEntity<TimedEntryResponse> updateTimedEntry(
            @PathVariable UUID id,
            @Valid @RequestBody CreateTimedEntryRequest request
    ) {
        return ResponseEntity.ok(scheduleService.updateTimedEntry(id, request));
    }

    @DeleteMapping("/schedules/{id}")
    public ResponseEntity<Void> deleteTimedEntry(@PathVariable UUID id) {
        scheduleService.deleteTimedEntry(id);
        return ResponseEntity.noContent().build();
    }
}
