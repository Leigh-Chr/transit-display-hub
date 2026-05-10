package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RealtimeAlertCacheTest {

    @Test
    void disabledByDefault_emptyAlertsUrl() {
        RealtimeAlertCache cache = new RealtimeAlertCache();
        assertFalse(cache.isEnabled());
        assertTrue(cache.activeAlerts(Instant.now()).isEmpty());
        assertEquals(FeedHeaderInfo.empty(), cache.currentHeader());
    }

    @Test
    void refresh_isNoOpWhenDisabled() {
        RealtimeAlertCache cache = new RealtimeAlertCache();
        cache.refresh();
        assertTrue(cache.activeAlerts(Instant.now()).isEmpty());
    }

    @Test
    void parseAlerts_skipsDeletedAndNonAlertEntities() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("deleted-1").setIsDeleted(true)
                        .setAlert(GtfsRealtime.Alert.newBuilder().build())
                        .build())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("trip-only")
                        .setTripUpdate(GtfsRealtime.TripUpdate.newBuilder().build())
                        .build())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("alert-1")
                        .setAlert(GtfsRealtime.Alert.newBuilder()
                                .setHeaderText(translatedString("Travaux"))
                                .build())
                        .build())
                .build();

        List<RealtimeAlertCache.AlertSnapshot> snapshots = RealtimeAlertCache.parseAlerts(feed);

        assertEquals(1, snapshots.size());
        assertEquals("alert-1", snapshots.get(0).id());
        assertEquals("Travaux", snapshots.get(0).headerText());
    }

    @Test
    void parseAlerts_indexesRoutesStopsAndAgencies() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("a")
                        .setAlert(GtfsRealtime.Alert.newBuilder()
                                .addInformedEntity(GtfsRealtime.EntitySelector.newBuilder()
                                        .setRouteId("R1").build())
                                .addInformedEntity(GtfsRealtime.EntitySelector.newBuilder()
                                        .setRouteId("R2").build())
                                .addInformedEntity(GtfsRealtime.EntitySelector.newBuilder()
                                        .setStopId("S1").build())
                                .addInformedEntity(GtfsRealtime.EntitySelector.newBuilder()
                                        .setAgencyId("AG1").build())
                                .addInformedEntity(GtfsRealtime.EntitySelector.newBuilder()
                                        .setRouteId("").setStopId("").setAgencyId("").build())
                                .setHeaderText(translatedString("Header"))
                                .setDescriptionText(translatedString("Desc"))
                                .setUrl(translatedString("https://example.test/alert"))
                                .setCause(GtfsRealtime.Alert.Cause.WEATHER)
                                .setEffect(GtfsRealtime.Alert.Effect.DETOUR)
                                .setSeverityLevel(GtfsRealtime.Alert.SeverityLevel.WARNING)
                                .build())
                        .build())
                .build();

        RealtimeAlertCache.AlertSnapshot snapshot = RealtimeAlertCache.parseAlerts(feed).get(0);

        assertEquals(2, snapshot.routeExternalIds().size());
        assertTrue(snapshot.routeExternalIds().contains("R1"));
        assertTrue(snapshot.routeExternalIds().contains("R2"));
        assertEquals(1, snapshot.stopExternalIds().size());
        assertEquals(1, snapshot.agencyExternalIds().size());
        assertEquals("Header", snapshot.headerText());
        assertEquals("Desc", snapshot.descriptionText());
        assertEquals("https://example.test/alert", snapshot.url());
        assertEquals(GtfsRealtime.Alert.Cause.WEATHER, snapshot.cause());
        assertEquals(GtfsRealtime.Alert.Effect.DETOUR, snapshot.effect());
        assertEquals(GtfsRealtime.Alert.SeverityLevel.WARNING, snapshot.severity());
    }

    @Test
    void parseAlerts_emptyTranslationsYieldNullText() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("a")
                        .setAlert(GtfsRealtime.Alert.newBuilder().build())
                        .build())
                .build();

        RealtimeAlertCache.AlertSnapshot snapshot = RealtimeAlertCache.parseAlerts(feed).get(0);

        assertNull(snapshot.headerText());
        assertNull(snapshot.descriptionText());
        assertNull(snapshot.url());
    }

    @Test
    void parseHeader_capturesTimestampVersionAndIncrementality() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(GtfsRealtime.FeedHeader.newBuilder()
                        .setTimestamp(1_700_000_000L)
                        .setGtfsRealtimeVersion("2.0")
                        .setIncrementality(GtfsRealtime.FeedHeader.Incrementality.DIFFERENTIAL)
                        .build())
                .build();

        FeedHeaderInfo header = RealtimeAlertCache.parseHeader(feed);

        assertEquals(1_700_000_000L, header.timestampEpochSeconds());
        assertEquals("DIFFERENTIAL", header.incrementality());
        assertEquals("2.0", header.version());
    }

    @Test
    void parseHeader_returnsVersionOnlyWhenOtherFieldsAreAbsent() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(GtfsRealtime.FeedHeader.newBuilder()
                        .setGtfsRealtimeVersion("2.0").build())
                .build();
        FeedHeaderInfo header = RealtimeAlertCache.parseHeader(feed);
        assertEquals("2.0", header.version());
        assertNull(header.timestampEpochSeconds());
        assertNull(header.incrementality());
    }


    @Test
    void alertSnapshot_isActiveAt_handlesEmptyAndBoundedPeriods() {
        RealtimeAlertCache.AlertSnapshot always = new RealtimeAlertCache.AlertSnapshot(
                "a", java.util.Set.of(), java.util.Set.of(), java.util.Set.of(),
                null, null, null,
                GtfsRealtime.Alert.Cause.UNKNOWN_CAUSE,
                GtfsRealtime.Alert.Effect.UNKNOWN_EFFECT,
                GtfsRealtime.Alert.SeverityLevel.UNKNOWN_SEVERITY,
                List.of());
        assertTrue(always.isActiveAt(Instant.ofEpochSecond(42)));

        GtfsRealtime.TimeRange period = GtfsRealtime.TimeRange.newBuilder()
                .setStart(100).setEnd(200).build();
        RealtimeAlertCache.AlertSnapshot bounded = new RealtimeAlertCache.AlertSnapshot(
                "b", java.util.Set.of(), java.util.Set.of(), java.util.Set.of(),
                null, null, null, null, null, null, List.of(period));

        assertFalse(bounded.isActiveAt(Instant.ofEpochSecond(99)));
        assertTrue(bounded.isActiveAt(Instant.ofEpochSecond(150)));
        assertFalse(bounded.isActiveAt(Instant.ofEpochSecond(201)));
    }

    @Test
    void alertSnapshot_isActiveAt_periodWithoutStartOrEnd() {
        GtfsRealtime.TimeRange noEnd = GtfsRealtime.TimeRange.newBuilder().setStart(100).build();
        GtfsRealtime.TimeRange noStart = GtfsRealtime.TimeRange.newBuilder().setEnd(200).build();
        RealtimeAlertCache.AlertSnapshot openEnd = snapshotWithPeriod(noEnd);
        RealtimeAlertCache.AlertSnapshot openStart = snapshotWithPeriod(noStart);

        assertFalse(openEnd.isActiveAt(Instant.ofEpochSecond(99)));
        assertTrue(openEnd.isActiveAt(Instant.ofEpochSecond(1_000_000_000L)));
        assertTrue(openStart.isActiveAt(Instant.ofEpochSecond(0)));
        assertFalse(openStart.isActiveAt(Instant.ofEpochSecond(201)));
    }

    private static RealtimeAlertCache.AlertSnapshot snapshotWithPeriod(GtfsRealtime.TimeRange period) {
        return new RealtimeAlertCache.AlertSnapshot(
                "id", java.util.Set.of(), java.util.Set.of(), java.util.Set.of(),
                null, null, null, null, null, null, List.of(period));
    }

    private static GtfsRealtime.FeedHeader headerNow() {
        return GtfsRealtime.FeedHeader.newBuilder()
                .setGtfsRealtimeVersion("2.0")
                .setTimestamp(Instant.now().getEpochSecond())
                .build();
    }

    private static GtfsRealtime.TranslatedString translatedString(String text) {
        return GtfsRealtime.TranslatedString.newBuilder()
                .addTranslation(GtfsRealtime.TranslatedString.Translation.newBuilder()
                        .setText(text)
                        .build())
                .build();
    }
}
