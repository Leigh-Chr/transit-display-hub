package com.transit.hub.api.rest;

import com.transit.hub.api.rest.support.Pageables;
import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.service.LineService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

@RestController
@RequestMapping("/api/lines")
@RequiredArgsConstructor
@Tag(name = "Administration — lignes",
     description = "CRUD des lignes du réseau (routes GTFS).")
public class LineController {

    private final LineService lineService;

    @GetMapping
    public ResponseEntity<?> getAllLines(
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer size,
            @RequestParam(required = false, defaultValue = "code") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search
    ) {
        if (page != null) {
            Pageable pageable = Pageables.from(page, size, sortBy, sortDir);
            return ResponseEntity.ok(lineService.getAllLines(search, pageable));
        }
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
