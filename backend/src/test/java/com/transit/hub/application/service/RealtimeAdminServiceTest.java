package com.transit.hub.application.service;

import com.google.transit.realtime.GtfsRealtime;
import com.transit.hub.application.dto.response.RealtimeAlertResponse;
import com.transit.hub.application.dto.response.VehiclePositionResponse;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import com.transit.hub.infrastructure.realtime.RealtimeVehiclePositionCache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RealtimeAdminServiceTest {

    private RealtimeAlertCache alertCache;
    private RealtimeVehiclePositionCache vehicleCache;
    private RealtimeAdminService service;

    @BeforeEach
    void setUp() {
        alertCache = mock(RealtimeAlertCache.class);
        vehicleCache = mock(RealtimeVehiclePositionCache.class);
        Clock clock = Clock.fixed(Instant.parse("2026-05-18T10:00:00Z"), ZoneOffset.UTC);
        service = new RealtimeAdminService(alertCache, vehicleCache, clock);
    }

    @Test
    void activeAlerts_mapsSnapshotFieldsIntoResponseDto() {
        RealtimeAlertCache.AlertSnapshot snap = new RealtimeAlertCache.AlertSnapshot(
                "alert-1",
                Set.of("R1"), Set.of("S1"), Set.of("A1"),
                "Header", "Description", "https://info",
                GtfsRealtime.Alert.Cause.MAINTENANCE,
                GtfsRealtime.Alert.Effect.REDUCED_SERVICE,
                GtfsRealtime.Alert.SeverityLevel.WARNING,
                List.of());
        when(alertCache.activeAlerts(any())).thenReturn(List.of(snap));

        List<RealtimeAlertResponse> result = service.activeAlerts();

        assertEquals(1, result.size());
        RealtimeAlertResponse r = result.get(0);
        assertEquals("alert-1", r.id());
        assertEquals(List.of("R1"), r.routeIds());
        assertEquals(List.of("S1"), r.stopIds());
        assertEquals(List.of("A1"), r.agencyIds());
        assertEquals("Header", r.headerText());
        assertEquals("Description", r.descriptionText());
        assertEquals("https://info", r.url());
        assertEquals("MAINTENANCE", r.cause());
        assertEquals("REDUCED_SERVICE", r.effect());
        assertEquals("WARNING", r.severity());
    }

    @Test
    void activeAlerts_handlesNullEnumsGracefully() {
        RealtimeAlertCache.AlertSnapshot snap = new RealtimeAlertCache.AlertSnapshot(
                "alert-2", Set.of(), Set.of(), Set.of(),
                "h", "d", null, null, null, null, List.of());
        when(alertCache.activeAlerts(any())).thenReturn(List.of(snap));

        RealtimeAlertResponse r = service.activeAlerts().get(0);
        assertEquals(null, r.cause());
        assertEquals(null, r.effect());
        assertEquals(null, r.severity());
    }

    @Test
    void refreshAlerts_returnsEmptyWhenFeedDisabled() {
        when(alertCache.isEnabled()).thenReturn(false);

        Optional<List<RealtimeAlertResponse>> result = service.refreshAlerts();

        assertTrue(result.isEmpty());
        verify(alertCache, never()).refresh();
    }

    @Test
    void refreshAlerts_triggersRefreshAndReturnsCurrentAlertsWhenEnabled() {
        when(alertCache.isEnabled()).thenReturn(true);
        when(alertCache.activeAlerts(any())).thenReturn(List.of());

        Optional<List<RealtimeAlertResponse>> result = service.refreshAlerts();

        assertTrue(result.isPresent());
        assertTrue(result.get().isEmpty());
        verify(alertCache).refresh();
    }

    @Test
    void currentVehicles_mapsSnapshotFieldsIntoResponseDto() {
        RealtimeVehiclePositionCache.VehicleSnapshot snap = new RealtimeVehiclePositionCache.VehicleSnapshot(
                "ent-1", "veh-1", "Bus 42",
                "trip-7", "R1",
                45.18, 5.72,
                90f, 12.5f,
                "IN_TRANSIT_TO", "stop-3", 4,
                "RUNNING_SMOOTHLY", "FEW_SEATS_AVAILABLE", 65,
                1716027600L);
        when(vehicleCache.currentSnapshot()).thenReturn(List.of(snap));

        List<VehiclePositionResponse> result = service.currentVehicles();

        assertEquals(1, result.size());
        VehiclePositionResponse v = result.get(0);
        assertEquals("ent-1", v.entityId());
        assertEquals("veh-1", v.vehicleId());
        assertEquals("Bus 42", v.vehicleLabel());
        assertEquals("trip-7", v.tripId());
        assertEquals("R1", v.routeId());
        assertEquals(45.18, v.latitude());
        assertEquals(5.72, v.longitude());
        assertEquals(90f, v.bearing());
        assertEquals(12.5f, v.speedMetresPerSecond());
        assertEquals("FEW_SEATS_AVAILABLE", v.occupancyStatus());
        assertEquals(65, v.occupancyPercentage());
    }

    @Test
    void refreshVehicles_returnsEmptyWhenFeedDisabled() {
        when(vehicleCache.isEnabled()).thenReturn(false);

        Optional<List<VehiclePositionResponse>> result = service.refreshVehicles();

        assertTrue(result.isEmpty());
        verify(vehicleCache, never()).refresh();
    }

    @Test
    void refreshVehicles_triggersRefreshAndReturnsCurrentSnapshotWhenEnabled() {
        when(vehicleCache.isEnabled()).thenReturn(true);
        when(vehicleCache.currentSnapshot()).thenReturn(List.of());

        Optional<List<VehiclePositionResponse>> result = service.refreshVehicles();

        assertTrue(result.isPresent());
        assertTrue(result.get().isEmpty());
        verify(vehicleCache).refresh();
    }
}
