package com.transit.hub.api.rest;

import com.transit.hub.api.rest.support.Pageables;
import com.transit.hub.application.dto.request.CreateStopRequest;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.dto.response.StopResponse;
import com.transit.hub.application.service.StopService;
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

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/stops")
@RequiredArgsConstructor
@Tag(name = "Administration — arrêts",
     description = "CRUD des arrêts physiques et association aux lignes.")
public class StopController {

    private static final Set<String> ALLOWED_STOP_SORTS = Set.of("name", "latitude", "longitude");

    private final StopService stopService;

    @GetMapping
    public ResponseEntity<PageResponse<StopResponse>> getAllStops(
            @RequestParam(required = false) UUID lineId,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer size,
            @RequestParam(required = false, defaultValue = "name") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search
    ) {
        Pageable pageable = Pageables.fromWhitelisted(page, size, sortBy, sortDir,
                ALLOWED_STOP_SORTS, "name");
        return ResponseEntity.ok(stopService.getAllStops(lineId, search, pageable));
    }

    /**
     * Non-paginated companion for dropdown / autocomplete callers that
     * legitimately need the whole list. Bounded by
     * {@code UnpaginatedCap} so a runaway feed cannot DoS the JSON path.
     */
    @GetMapping("/all")
    public ResponseEntity<List<StopResponse>> getAllStopsUnpaginated(
            @RequestParam(required = false) UUID lineId
    ) {
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
