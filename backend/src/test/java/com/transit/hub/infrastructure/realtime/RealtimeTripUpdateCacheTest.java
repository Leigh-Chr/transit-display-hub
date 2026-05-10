package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RealtimeTripUpdateCacheTest {

    @Test
    void disabledByDefault_emptyTripUpdatesUrl() {
        RealtimeTripUpdateCache cache = new RealtimeTripUpdateCache();
        assertFalse(cache.isEnabled());
        assertEquals(0, cache.snapshotSize());
        assertNotNull(cache.currentHeader());
    }

    @Test
    void findUpdate_returnsEmptyForNullOrUnknownTripId() {
        RealtimeTripUpdateCache cache = new RealtimeTripUpdateCache();
        assertEquals(Optional.empty(), cache.findUpdate(null));
        assertEquals(Optional.empty(), cache.findUpdate("unknown-trip"));
    }

    @Test
    void refresh_isNoOpWhenDisabled() {
        RealtimeTripUpdateCache cache = new RealtimeTripUpdateCache();
        cache.refresh();
        assertEquals(0, cache.snapshotSize());
    }

    @Test
    void parseTripUpdates_skipsDeletedAndNonTripEntities() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("deleted").setIsDeleted(true)
                        .setTripUpdate(tripUpdate("deleted-trip"))
                        .build())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("alert-only")
                        .setAlert(GtfsRealtime.Alert.newBuilder().build())
                        .build())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("kept")
                        .setTripUpdate(tripUpdate("trip-1"))
                        .build())
                .build();

        Map<String, RealtimeTripUpdateCache.TripAdjustment> map = RealtimeTripUpdateCache.parseTripUpdates(feed);

        assertEquals(1, map.size());
        assertTrue(map.containsKey("trip-1"));
    }

    @Test
    void parseTripUpdates_capturesTripLevelMetadataAndStopTimes() {
        GtfsRealtime.TripUpdate.StopTimeUpdate skipped = GtfsRealtime.TripUpdate.StopTimeUpdate.newBuilder()
                .setStopId("S2")
                .setScheduleRelationship(GtfsRealtime.TripUpdate.StopTimeUpdate.ScheduleRelationship.SKIPPED)
                .build();
        GtfsRealtime.TripUpdate.StopTimeUpdate withDelays = GtfsRealtime.TripUpdate.StopTimeUpdate.newBuilder()
                .setStopId("S1")
                .setArrival(GtfsRealtime.TripUpdate.StopTimeEvent.newBuilder()
                        .setDelay(60).setTime(1_700_000_060L).build())
                .setDeparture(GtfsRealtime.TripUpdate.StopTimeEvent.newBuilder()
                        .setDelay(90).setTime(1_700_000_090L).build())
                .build();
        GtfsRealtime.TripUpdate.StopTimeUpdate noStopId = GtfsRealtime.TripUpdate.StopTimeUpdate.newBuilder()
                // No stop_id set, only sequence — currently dropped.
                .setStopSequence(7)
                .build();

        GtfsRealtime.TripUpdate update = GtfsRealtime.TripUpdate.newBuilder()
                .setTrip(GtfsRealtime.TripDescriptor.newBuilder().setTripId("trip-7").build())
                .setDelay(45)
                .setVehicle(GtfsRealtime.VehicleDescriptor.newBuilder()
                        .setId("V42").setLabel("BUS-42").build())
                .setTimestamp(1_700_000_000L)
                .addStopTimeUpdate(withDelays)
                .addStopTimeUpdate(skipped)
                .addStopTimeUpdate(noStopId)
                .build();

        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("e1").setTripUpdate(update).build())
                .build();

        RealtimeTripUpdateCache.TripAdjustment trip = RealtimeTripUpdateCache.parseTripUpdates(feed).get("trip-7");

        assertNotNull(trip);
        assertEquals(45, trip.tripLevelDelaySeconds());
        assertEquals("V42", trip.vehicleId());
        assertEquals("BUS-42", trip.vehicleLabel());
        assertEquals(1_700_000_000L, trip.timestampEpochSeconds());
        assertEquals(2, trip.byStopExternalId().size(), "noStopId entry must be dropped");

        RealtimeTripUpdateCache.StopAdjustment s1 = trip.byStopExternalId().get("S1");
        assertEquals(60, s1.arrivalDelaySeconds());
        assertEquals(90, s1.departureDelaySeconds());
        assertEquals(1_700_000_060L, s1.arrivalEpochSeconds());
        assertEquals(1_700_000_090L, s1.departureEpochSeconds());
        assertFalse(s1.skipped());
        assertEquals(60, s1.effectiveDelaySeconds(), "effective delay prefers arrival");

        RealtimeTripUpdateCache.StopAdjustment s2 = trip.byStopExternalId().get("S2");
        assertTrue(s2.skipped());
    }

    @Test
    void parseTripUpdates_dropsTripsWithoutTripDescriptor() {
        GtfsRealtime.TripUpdate noTrip = GtfsRealtime.TripUpdate.newBuilder()
                .setDelay(10)
                .build();
        GtfsRealtime.TripUpdate noTripId = GtfsRealtime.TripUpdate.newBuilder()
                .setTrip(GtfsRealtime.TripDescriptor.newBuilder().build())
                .build();
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder().setId("a").setTripUpdate(noTrip).build())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder().setId("b").setTripUpdate(noTripId).build())
                .build();

        assertEquals(0, RealtimeTripUpdateCache.parseTripUpdates(feed).size());
    }

    @Test
    void stopAdjustment_effectiveDelay_fallsBackToDeparture() {
        RealtimeTripUpdateCache.StopAdjustment onlyDeparture = new RealtimeTripUpdateCache.StopAdjustment(
                "S", null, 30, null, null, false);
        assertEquals(30, onlyDeparture.effectiveDelaySeconds());
    }

    @Test
    void stopAdjustment_effectiveDelay_isNullWhenBothMissing() {
        RealtimeTripUpdateCache.StopAdjustment empty = new RealtimeTripUpdateCache.StopAdjustment(
                "S", null, null, null, null, false);
        assertNull(empty.effectiveDelaySeconds());
    }

    private static GtfsRealtime.FeedHeader headerNow() {
        return GtfsRealtime.FeedHeader.newBuilder()
                .setGtfsRealtimeVersion("2.0")
                .setTimestamp(java.time.Instant.now().getEpochSecond())
                .build();
    }

    private static GtfsRealtime.TripUpdate tripUpdate(String tripId) {
        return GtfsRealtime.TripUpdate.newBuilder()
                .setTrip(GtfsRealtime.TripDescriptor.newBuilder().setTripId(tripId).build())
                .build();
    }
}
