package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.AgencyResponse;
import com.transit.hub.application.service.AgencyService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Lists the operating agencies known to the network. Reachable to any
 * authenticated user (admin and agent both have legitimate need: agents
 * see agency names when scoping a message, admins manage them).
 */
@RestController
@RequestMapping("/api/agencies")
@RequiredArgsConstructor
@Tag(name = "Données GTFS — agences",
     description = "Liste des agences exploitantes connues du réseau.")
public class AgencyController {

    private final AgencyService agencyService;

    @GetMapping
    public ResponseEntity<List<AgencyResponse>> getAllAgencies() {
        return ResponseEntity.ok(agencyService.getAllAgencies());
    }
}
