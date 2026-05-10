package com.transit.hub.api.rest;

import com.transit.hub.api.rest.support.Pageables;
import com.transit.hub.application.dto.request.AddItineraryStopRequest;
import com.transit.hub.application.dto.request.CreateItineraryRequest;
import com.transit.hub.application.dto.request.UpdateItineraryStopsRequest;
import com.transit.hub.application.dto.response.ItineraryResponse;
import com.transit.hub.application.service.ItineraryService;
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
@RequestMapping("/api/itineraries")
@RequiredArgsConstructor
@Tag(name = "Administration — itinéraires",
     description = "CRUD des itinéraires (séquences ordonnées d'arrêts pour une ligne et une direction).")
public class ItineraryController {

    private final ItineraryService itineraryService;

    @GetMapping
    public ResponseEntity<?> getAllItineraries(
            @RequestParam(required = false) UUID lineId,
            @RequestParam(required = false) Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer size,
            @RequestParam(required = false, defaultValue = "name") String sortBy,
            @RequestParam(required = false, defaultValue = "asc") String sortDir,
            @RequestParam(required = false) String search
    ) {
        if (page != null) {
            Pageable pageable = Pageables.from(page, size, sortBy, sortDir);
            return ResponseEntity.ok(itineraryService.getAllItineraries(lineId, search, pageable));
        }
        if (lineId != null) {
            return ResponseEntity.ok(itineraryService.getItinerariesByLine(lineId));
        }
        return ResponseEntity.ok(itineraryService.getAllItineraries());
    }

    @GetMapping("/{id}")
    public ResponseEntity<ItineraryResponse> getItinerary(@PathVariable UUID id) {
        return ResponseEntity.ok(itineraryService.getItinerary(id));
    }

    @PostMapping
    public ResponseEntity<ItineraryResponse> createItinerary(@Valid @RequestBody CreateItineraryRequest request) {
        ItineraryResponse created = itineraryService.createItinerary(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<ItineraryResponse> updateItinerary(@PathVariable UUID id, @Valid @RequestBody CreateItineraryRequest request) {
        return ResponseEntity.ok(itineraryService.updateItinerary(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteItinerary(@PathVariable UUID id) {
        itineraryService.deleteItinerary(id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/stops")
    public ResponseEntity<ItineraryResponse> updateItineraryStops(
            @PathVariable UUID id,
            @Valid @RequestBody UpdateItineraryStopsRequest request
    ) {
        return ResponseEntity.ok(itineraryService.updateItineraryStops(id, request));
    }

    @PostMapping("/{id}/stops")
    public ResponseEntity<ItineraryResponse> addStopToItinerary(
            @PathVariable UUID id,
            @Valid @RequestBody AddItineraryStopRequest request
    ) {
        ItineraryResponse updated = itineraryService.addStopToItinerary(id, request);
        return ResponseEntity.status(HttpStatus.CREATED).body(updated);
    }

    @DeleteMapping("/{id}/stops/{stopId}")
    public ResponseEntity<ItineraryResponse> removeStopFromItinerary(
            @PathVariable UUID id,
            @PathVariable UUID stopId
    ) {
        return ResponseEntity.ok(itineraryService.removeStopFromItinerary(id, stopId));
    }
}
