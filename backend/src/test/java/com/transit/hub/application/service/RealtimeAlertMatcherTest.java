package com.transit.hub.application.service;

import com.google.transit.realtime.GtfsRealtime;
import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.time.Instant;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

/**
 * Covers the alert-matching logic extracted from
 * {@link DisplayStateCalculator}. The two static helpers are deterministic
 * so they are exercised directly; the instance method runs against a
 * Mockito stub of {@link RealtimeAlertCache}.
 */
class RealtimeAlertMatcherTest {

    private RealtimeAlertCache cache;
    private RealtimeAlertMatcher matcher;

    @BeforeEach
    void setUp() {
        cache = Mockito.mock(RealtimeAlertCache.class);
        matcher = new RealtimeAlertMatcher(cache);
    }

    // --- matchesStop ---------------------------------------------------

    @Test
    void matchesStop_returnsTrueWhenInformedEntityIsEmpty() {
        RealtimeAlertCache.AlertSnapshot alert = snapshot(Set.of(), Set.of(), Set.of());
        assertTrue(RealtimeAlertMatcher.matchesStop(alert, "stop-1", Set.of("L1"), Set.of("A1")));
    }

    @Test
    void matchesStop_returnsTrueOnStopIdHit() {
        RealtimeAlertCache.AlertSnapshot alert = snapshot(Set.of(), Set.of("stop-1"), Set.of());
        assertTrue(RealtimeAlertMatcher.matchesStop(alert, "stop-1", Set.of(), Set.of()));
    }

    @Test
    void matchesStop_returnsTrueOnLineIdHit() {
        RealtimeAlertCache.AlertSnapshot alert = snapshot(Set.of("L1"), Set.of(), Set.of());
        assertTrue(RealtimeAlertMatcher.matchesStop(alert, "stop-1", Set.of("L1", "L2"), Set.of()));
    }

    @Test
    void matchesStop_returnsTrueOnAgencyIdHit() {
        RealtimeAlertCache.AlertSnapshot alert = snapshot(Set.of(), Set.of(), Set.of("A1"));
        assertTrue(RealtimeAlertMatcher.matchesStop(alert, "stop-1", Set.of(), Set.of("A1")));
    }

    @Test
    void matchesStop_returnsFalseWhenNoTargetMatches() {
        RealtimeAlertCache.AlertSnapshot alert = snapshot(Set.of("L99"), Set.of("stop-99"), Set.of("A99"));
        assertFalse(RealtimeAlertMatcher.matchesStop(alert, "stop-1", Set.of("L1"), Set.of("A1")));
    }

    @Test
    void matchesStop_ignoresNullStopExternalId() {
        RealtimeAlertCache.AlertSnapshot alert = snapshot(Set.of(), Set.of("stop-1"), Set.of());
        assertFalse(RealtimeAlertMatcher.matchesStop(alert, null, Set.of(), Set.of()));
    }

    // --- severityFromAlert ---------------------------------------------

    @Test
    void severityFromAlert_explicitSevereMapsToCritical() {
        RealtimeAlertCache.AlertSnapshot a = snapshotWithSeverity(GtfsRealtime.Alert.SeverityLevel.SEVERE);
        assertEquals(MessageSeverity.CRITICAL, RealtimeAlertMatcher.severityFromAlert(a));
    }

    @Test
    void severityFromAlert_explicitWarningMapsToWarning() {
        RealtimeAlertCache.AlertSnapshot a = snapshotWithSeverity(GtfsRealtime.Alert.SeverityLevel.WARNING);
        assertEquals(MessageSeverity.WARNING, RealtimeAlertMatcher.severityFromAlert(a));
    }

    @Test
    void severityFromAlert_explicitInfoMapsToInfo() {
        RealtimeAlertCache.AlertSnapshot a = snapshotWithSeverity(GtfsRealtime.Alert.SeverityLevel.INFO);
        assertEquals(MessageSeverity.INFO, RealtimeAlertMatcher.severityFromAlert(a));
    }

    @Test
    void severityFromAlert_unknownSeverityInfersFromEffectNoService() {
        RealtimeAlertCache.AlertSnapshot a = snapshotWithEffect(GtfsRealtime.Alert.Effect.NO_SERVICE);
        assertEquals(MessageSeverity.CRITICAL, RealtimeAlertMatcher.severityFromAlert(a));
    }

    @Test
    void severityFromAlert_unknownSeverityInfersDetourAsWarning() {
        RealtimeAlertCache.AlertSnapshot a = snapshotWithEffect(GtfsRealtime.Alert.Effect.DETOUR);
        assertEquals(MessageSeverity.WARNING, RealtimeAlertMatcher.severityFromAlert(a));
    }

    @Test
    void severityFromAlert_unknownSeverityFallsBackToInfo() {
        RealtimeAlertCache.AlertSnapshot a = snapshotWithEffect(GtfsRealtime.Alert.Effect.OTHER_EFFECT);
        assertEquals(MessageSeverity.INFO, RealtimeAlertMatcher.severityFromAlert(a));
    }

    // --- buildRealtimeMessages -----------------------------------------

    @Test
    void buildRealtimeMessages_returnsEmptyWhenNoActiveAlerts() {
        when(cache.activeAlerts(Mockito.any())).thenReturn(List.of());
        List<DisplayState.MessageInfo> result = matcher.buildRealtimeMessages(stop("stop-1"), Instant.now());
        assertTrue(result.isEmpty());
    }

    @Test
    void buildRealtimeMessages_dropsAlertsWithoutText() {
        RealtimeAlertCache.AlertSnapshot blank = new RealtimeAlertCache.AlertSnapshot(
                "a1", Set.of(), Set.of(), Set.of(),
                null, "  ",
                null,
                GtfsRealtime.Alert.Cause.UNKNOWN_CAUSE,
                GtfsRealtime.Alert.Effect.UNKNOWN_EFFECT,
                GtfsRealtime.Alert.SeverityLevel.INFO,
                List.of());
        when(cache.activeAlerts(Mockito.any())).thenReturn(List.of(blank));

        List<DisplayState.MessageInfo> result = matcher.buildRealtimeMessages(stop("stop-1"), Instant.now());
        assertTrue(result.isEmpty());
    }

    @Test
    void buildRealtimeMessages_keepsMatchingAlertWithHeader() {
        RealtimeAlertCache.AlertSnapshot keep = new RealtimeAlertCache.AlertSnapshot(
                "a1", Set.of(), Set.of("stop-1"), Set.of(),
                "Travaux",
                "Détails",
                null,
                GtfsRealtime.Alert.Cause.MAINTENANCE,
                GtfsRealtime.Alert.Effect.REDUCED_SERVICE,
                GtfsRealtime.Alert.SeverityLevel.WARNING,
                List.of());
        when(cache.activeAlerts(Mockito.any())).thenReturn(List.of(keep));

        List<DisplayState.MessageInfo> result = matcher.buildRealtimeMessages(stop("stop-1"), Instant.now());
        assertEquals(1, result.size());
        assertEquals("Travaux", result.get(0).title());
        assertEquals("Détails", result.get(0).content());
        assertEquals(MessageSeverity.WARNING, result.get(0).severity());
    }

    @Test
    void buildRealtimeMessages_skipsAlertsNotMatchingThisStop() {
        RealtimeAlertCache.AlertSnapshot otherStop = new RealtimeAlertCache.AlertSnapshot(
                "a1", Set.of(), Set.of("stop-other"), Set.of(),
                "Travaux", "x", null,
                GtfsRealtime.Alert.Cause.UNKNOWN_CAUSE,
                GtfsRealtime.Alert.Effect.UNKNOWN_EFFECT,
                GtfsRealtime.Alert.SeverityLevel.INFO,
                List.of());
        when(cache.activeAlerts(Mockito.any())).thenReturn(List.of(otherStop));

        List<DisplayState.MessageInfo> result = matcher.buildRealtimeMessages(stop("stop-1"), Instant.now());
        assertTrue(result.isEmpty());
    }

    @Test
    void buildRealtimeMessages_fallsBackToAlerteWhenHeaderBlank() {
        RealtimeAlertCache.AlertSnapshot headerlessButDescribed = new RealtimeAlertCache.AlertSnapshot(
                "a1", Set.of(), Set.of(), Set.of(),
                "  ", "Description seule", null,
                GtfsRealtime.Alert.Cause.UNKNOWN_CAUSE,
                GtfsRealtime.Alert.Effect.UNKNOWN_EFFECT,
                GtfsRealtime.Alert.SeverityLevel.INFO,
                List.of());
        when(cache.activeAlerts(Mockito.any())).thenReturn(List.of(headerlessButDescribed));

        List<DisplayState.MessageInfo> result = matcher.buildRealtimeMessages(stop("stop-1"), Instant.now());
        assertEquals(1, result.size());
        assertEquals("Alerte", result.get(0).title());
    }

    // --- helpers --------------------------------------------------------

    private static RealtimeAlertCache.AlertSnapshot snapshot(Set<String> routeIds,
                                                              Set<String> stopIds,
                                                              Set<String> agencyIds) {
        return new RealtimeAlertCache.AlertSnapshot(
                "a", routeIds, stopIds, agencyIds,
                "h", "d", null,
                GtfsRealtime.Alert.Cause.UNKNOWN_CAUSE,
                GtfsRealtime.Alert.Effect.UNKNOWN_EFFECT,
                GtfsRealtime.Alert.SeverityLevel.INFO,
                List.of());
    }

    private static RealtimeAlertCache.AlertSnapshot snapshotWithSeverity(GtfsRealtime.Alert.SeverityLevel level) {
        return new RealtimeAlertCache.AlertSnapshot(
                "a", Set.of(), Set.of(), Set.of(),
                "h", "d", null,
                GtfsRealtime.Alert.Cause.UNKNOWN_CAUSE,
                GtfsRealtime.Alert.Effect.UNKNOWN_EFFECT,
                level,
                List.of());
    }

    private static RealtimeAlertCache.AlertSnapshot snapshotWithEffect(GtfsRealtime.Alert.Effect effect) {
        return new RealtimeAlertCache.AlertSnapshot(
                "a", Set.of(), Set.of(), Set.of(),
                "h", "d", null,
                GtfsRealtime.Alert.Cause.UNKNOWN_CAUSE,
                effect,
                GtfsRealtime.Alert.SeverityLevel.UNKNOWN_SEVERITY,
                List.of());
    }

    private static Stop stop(String externalId) {
        Agency agency = Agency.builder().externalId("agency-1").name("Agency").build();
        Line line = Line.builder()
                .externalId("L1")
                .code("L1")
                .name("Line 1")
                .type(LineType.BUS)
                .agency(agency)
                .build();
        Stop s = Stop.builder()
                .externalId(externalId)
                .name("Stop " + externalId)
                .latitude(45.0)
                .longitude(5.0)
                .build();
        s.setLines(List.of(line));
        return s;
    }
}
