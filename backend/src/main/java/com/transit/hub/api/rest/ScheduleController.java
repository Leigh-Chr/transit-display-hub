package com.transit.hub.api.rest;

import com.transit.hub.application.dto.request.CreateScheduleRequest;
import com.transit.hub.application.dto.response.ScheduleResponse;
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
    public ResponseEntity<List<ScheduleResponse>> getScheduleForStop(@PathVariable UUID stopId) {
        return ResponseEntity.ok(scheduleService.getScheduleForStop(stopId));
    }

    @PostMapping("/stops/{stopId}/schedules")
    public ResponseEntity<ScheduleResponse> createSchedule(
            @PathVariable UUID stopId,
            @Valid @RequestBody CreateScheduleRequest request
    ) {
        ScheduleResponse created = scheduleService.createSchedule(stopId, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/schedules/{id}")
    public ResponseEntity<ScheduleResponse> updateSchedule(
            @PathVariable UUID id,
            @Valid @RequestBody CreateScheduleRequest request
    ) {
        return ResponseEntity.ok(scheduleService.updateSchedule(id, request));
    }

    @DeleteMapping("/schedules/{id}")
    public ResponseEntity<Void> deleteSchedule(@PathVariable UUID id) {
        scheduleService.deleteSchedule(id);
        return ResponseEntity.noContent().build();
    }
}
