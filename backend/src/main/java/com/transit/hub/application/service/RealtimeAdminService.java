package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.RealtimeAlertResponse;
import com.transit.hub.application.dto.response.VehiclePositionResponse;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import com.transit.hub.infrastructure.realtime.RealtimeVehiclePositionCache;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

/**
 * Application-layer facade over the two read-only GTFS-Realtime caches
 * the admin endpoints expose: alerts and vehicle positions. Previously
 * the controllers reached into {@code infrastructure.realtime.*}
 * directly (audit P1 B-3); centralising the mapping and the cache-state
 * gating here restores the {@code api → application → infrastructure}
 * direction enforced by ArchUnit.
 *
 * <p>{@link Optional#empty()} returns from the refresh methods signal
 * "feed disabled" so the controller can answer with a 400 without
 * importing the cache state surface.
 */
@Service
@RequiredArgsConstructor
public class RealtimeAdminService {

    private final RealtimeAlertCache alertCache;
    private final RealtimeVehiclePositionCache vehicleCache;
    private final Clock clock;

    public List<RealtimeAlertResponse> activeAlerts() {
        return alertCache.activeAlerts(Instant.now(clock)).stream()
                .map(RealtimeAdminService::toResponse)
                .toList();
    }

    /** Returns empty when the alerts feed is disabled. */
    public Optional<List<RealtimeAlertResponse>> refreshAlerts() {
        if (!alertCache.isEnabled()) {
            return Optional.empty();
        }
        alertCache.refresh();
        return Optional.of(activeAlerts());
    }

    public List<VehiclePositionResponse> currentVehicles() {
        return vehicleCache.currentSnapshot().stream()
                .map(RealtimeAdminService::toResponse)
                .toList();
    }

    /** Returns empty when the vehicle-positions feed is disabled. */
    public Optional<List<VehiclePositionResponse>> refreshVehicles() {
        if (!vehicleCache.isEnabled()) {
            return Optional.empty();
        }
        vehicleCache.refresh();
        return Optional.of(currentVehicles());
    }

    private static RealtimeAlertResponse toResponse(RealtimeAlertCache.AlertSnapshot snap) {
        return new RealtimeAlertResponse(
                snap.id(),
                List.copyOf(snap.routeExternalIds()),
                List.copyOf(snap.stopExternalIds()),
                List.copyOf(snap.agencyExternalIds()),
                snap.headerText(),
                snap.descriptionText(),
                snap.url(),
                snap.cause() != null ? snap.cause().name() : null,
                snap.effect() != null ? snap.effect().name() : null,
                snap.severity() != null ? snap.severity().name() : null
        );
    }

    private static VehiclePositionResponse toResponse(RealtimeVehiclePositionCache.VehicleSnapshot snap) {
        return new VehiclePositionResponse(
                snap.entityId(),
                snap.vehicleId(),
                snap.vehicleLabel(),
                snap.tripId(),
                snap.routeId(),
                snap.latitude(),
                snap.longitude(),
                snap.bearing(),
                snap.speed(),
                snap.currentStatus(),
                snap.currentStopId(),
                snap.currentStopSequence(),
                snap.congestionLevel(),
                snap.occupancyStatus(),
                snap.occupancyPercentage(),
                snap.timestampEpochSeconds()
        );
    }
}
