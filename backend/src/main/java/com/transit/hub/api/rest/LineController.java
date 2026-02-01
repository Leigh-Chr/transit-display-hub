package com.transit.hub.api.rest;

import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.service.LineService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/lines")
@RequiredArgsConstructor
public class LineController {

    private final LineService lineService;

    @GetMapping
    public ResponseEntity<List<LineResponse>> getAllLines() {
        return ResponseEntity.ok(lineService.getAllLines());
    }

    @GetMapping("/{id}")
    public ResponseEntity<LineResponse> getLine(@PathVariable UUID id) {
        return ResponseEntity.ok(lineService.getLine(id));
    }

    @PostMapping
    public ResponseEntity<LineResponse> createLine(@Valid @RequestBody CreateLineRequest request) {
        LineResponse created = lineService.createLine(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<LineResponse> updateLine(@PathVariable UUID id, @Valid @RequestBody CreateLineRequest request) {
        return ResponseEntity.ok(lineService.updateLine(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteLine(@PathVariable UUID id) {
        lineService.deleteLine(id);
        return ResponseEntity.noContent().build();
    }
}
