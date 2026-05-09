package com.transit.hub.api.rest;

import com.transit.hub.application.dto.response.BookingRuleResponse;
import com.transit.hub.application.dto.response.FlexStopTimeResponse;
import com.transit.hub.application.dto.response.LocationResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.dto.response.StationPathwayGraphResponse;
import com.transit.hub.application.service.BookingRuleService;
import com.transit.hub.application.service.FlexAvailabilityService;
import com.transit.hub.application.service.LocationService;
import com.transit.hub.application.service.NetworkMapService;
import com.transit.hub.application.service.PathwayService;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/network-map")
@RequiredArgsConstructor
@Tag(name = "Carte réseau",
     description = "Carte schématique publique et alertes attachées au réseau.")
public class NetworkMapController {

    private final NetworkMapService networkMapService;
    private final LocationService locationService;
    private final BookingRuleService bookingRuleService;
    private final PathwayService pathwayService;
    private final FlexAvailabilityService flexAvailabilityService;

    @GetMapping
    public ResponseEntity<NetworkMapResponse> getNetworkMap() {
        return ResponseEntity.ok(networkMapService.getNetworkMap());
    }

    @GetMapping("/alerts")
    public ResponseEntity<AlertsResponse> getAlerts() {
        return ResponseEntity.ok(networkMapService.getAlerts());
    }

    /**
     * Public endpoint serving the GTFS-flex zone polygon attached to a
     * stop. Returns 404 when the stop has no flex location bound to it
     * — the stop-popup keys the request on {@code Stop.hasOnDemand}
     * but the spec allows on-demand pickups without an explicit zone
     * polygon, so a "no zone here" answer is normal.
     */
    @GetMapping("/stops/{stopId}/tad-zone")
    public ResponseEntity<LocationResponse> getStopTadZone(@PathVariable UUID stopId) {
        return locationService.findByStop(stopId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Public endpoint exposing the GTFS booking_rules attached to the
     * schedules and flex_stop_times of this stop. The popup uses it to
     * render booking instructions (phone, URL, prior notice) for an
     * on-demand stop. Always returns 200 — empty list when the stop
     * has no on-demand service.
     */
    @GetMapping("/stops/{stopId}/booking-rules")
    public ResponseEntity<List<BookingRuleResponse>> getStopBookingRules(@PathVariable UUID stopId) {
        return ResponseEntity.ok(bookingRuleService.findByStopId(stopId));
    }

    /**
     * Public endpoint exposing the indoor pathway graph rooted at the
     * station this stop belongs to. The popup uses it to render
     * "Pour rejoindre le quai 2, suivre l'ascenseur jusqu'au niveau -1".
     * Returns 404 when the stop itself is unknown; returns 200 with an
     * empty pathway list when the station has no indoor topology.
     */
    @GetMapping("/stops/{stopId}/pathways")
    public ResponseEntity<StationPathwayGraphResponse> getStopPathwayGraph(@PathVariable UUID stopId) {
        return pathwayService.findStationGraphForStop(stopId)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    /**
     * Public endpoint listing the GTFS-flex pickup/drop-off windows
     * available at the given location on the given date. The
     * {@code externalId} matches the GeoJSON Feature.id (which is the
     * spec-mandated key shared across stops / location_groups /
     * locations.geojson). Defaults to today when {@code date} is
     * omitted. Returns an empty array when the location has no flex
     * service running on that date — the caller renders nothing
     * rather than treating empty as an error.
     */
    @GetMapping("/locations/{externalId}/flex-windows")
    public ResponseEntity<List<FlexStopTimeResponse>> getLocationFlexWindows(
            @PathVariable String externalId,
            @RequestParam(required = false) LocalDate date) {
        return ResponseEntity.ok(flexAvailabilityService.findWindowsForLocation(externalId, date));
    }
}
