package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import com.transit.hub.infrastructure.config.GtfsRtProperties;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RealtimeVehiclePositionCacheTest {

    @Test
    void disabledByDefault_emptyVehiclePositionsUrl() {
        RealtimeVehiclePositionCache cache = new RealtimeVehiclePositionCache(propertiesFor(""));
        assertFalse(cache.isEnabled());
        assertTrue(cache.currentSnapshot().isEmpty());
        assertNotNull(cache.currentHeader());
    }

    @Test
    void refresh_isNoOpWhenDisabled() {
        RealtimeVehiclePositionCache cache = new RealtimeVehiclePositionCache(propertiesFor(""));
        cache.refresh();
        assertTrue(cache.currentSnapshot().isEmpty());
    }

    @Test
    void parseVehicles_skipsDeletedAndNonVehicleEntities() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("deleted").setIsDeleted(true)
                        .setVehicle(GtfsRealtime.VehiclePosition.newBuilder().build())
                        .build())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("alert-only")
                        .setAlert(GtfsRealtime.Alert.newBuilder().build())
                        .build())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("kept")
                        .setVehicle(GtfsRealtime.VehiclePosition.newBuilder().build())
                        .build())
                .build();

        List<RealtimeVehiclePositionCache.VehicleSnapshot> snapshots = RealtimeVehiclePositionCache.parseVehicles(feed);

        assertEquals(1, snapshots.size());
        assertEquals("kept", snapshots.get(0).entityId());
    }

    @Test
    void parseVehicles_capturesAllOptionalFields() {
        GtfsRealtime.VehiclePosition v = GtfsRealtime.VehiclePosition.newBuilder()
                .setVehicle(GtfsRealtime.VehicleDescriptor.newBuilder()
                        .setId("VID").setLabel("BUS-1").build())
                .setTrip(GtfsRealtime.TripDescriptor.newBuilder()
                        .setTripId("T1").setRouteId("R1").build())
                .setPosition(GtfsRealtime.Position.newBuilder()
                        .setLatitude(45.18f).setLongitude(5.72f)
                        .setBearing(180f).setSpeed(12.5f).build())
                .setCurrentStatus(GtfsRealtime.VehiclePosition.VehicleStopStatus.IN_TRANSIT_TO)
                .setStopId("STOP-A")
                .setCurrentStopSequence(3)
                .setCongestionLevel(GtfsRealtime.VehiclePosition.CongestionLevel.STOP_AND_GO)
                .setOccupancyStatus(GtfsRealtime.VehiclePosition.OccupancyStatus.STANDING_ROOM_ONLY)
                .setOccupancyPercentage(80)
                .setTimestamp(1_700_000_000L)
                .build();
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder().setId("e1").setVehicle(v).build())
                .build();

        RealtimeVehiclePositionCache.VehicleSnapshot snap = RealtimeVehiclePositionCache.parseVehicles(feed).get(0);

        assertEquals("VID", snap.vehicleId());
        assertEquals("BUS-1", snap.vehicleLabel());
        assertEquals("T1", snap.tripId());
        assertEquals("R1", snap.routeId());
        assertEquals(45.18, snap.latitude(), 0.001);
        assertEquals(5.72, snap.longitude(), 0.001);
        assertEquals(180f, snap.bearing());
        assertEquals(12.5f, snap.speed());
        assertEquals("IN_TRANSIT_TO", snap.currentStatus());
        assertEquals("STOP-A", snap.currentStopId());
        assertEquals(3, snap.currentStopSequence());
        assertEquals("STOP_AND_GO", snap.congestionLevel());
        assertEquals("STANDING_ROOM_ONLY", snap.occupancyStatus());
        assertEquals(80, snap.occupancyPercentage());
        assertEquals(1_700_000_000L, snap.timestampEpochSeconds());
    }

    @Test
    void parseVehicles_handlesEmptyFields() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(GtfsRealtime.FeedEntity.newBuilder()
                        .setId("e1")
                        .setVehicle(GtfsRealtime.VehiclePosition.newBuilder().build())
                        .build())
                .build();

        RealtimeVehiclePositionCache.VehicleSnapshot snap = RealtimeVehiclePositionCache.parseVehicles(feed).get(0);

        assertNull(snap.vehicleId());
        assertNull(snap.vehicleLabel());
        assertNull(snap.tripId());
        assertNull(snap.routeId());
        assertNull(snap.latitude());
        assertNull(snap.bearing());
        assertNull(snap.currentStatus());
        assertNull(snap.timestampEpochSeconds());
    }

    @Test
    void parseVehicles_sortsByRouteThenVehicleIdNullSafe() {
        GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.newBuilder()
                .setHeader(headerNow())
                .addEntity(entityWith("e-3", "R2", "V1"))
                .addEntity(entityWith("e-2", "R1", "V2"))
                .addEntity(entityWith("e-1", "R1", "V1"))
                .addEntity(entityWith("e-4", null, "V0"))   // null route — sorts last
                .build();

        List<RealtimeVehiclePositionCache.VehicleSnapshot> sorted = RealtimeVehiclePositionCache.parseVehicles(feed);

        assertEquals("R1", sorted.get(0).routeId());
        assertEquals("V1", sorted.get(0).vehicleId());
        assertEquals("R1", sorted.get(1).routeId());
        assertEquals("V2", sorted.get(1).vehicleId());
        assertEquals("R2", sorted.get(2).routeId());
        assertNull(sorted.get(3).routeId(), "null route should sort last");
    }

    private static GtfsRealtime.FeedHeader headerNow() {
        return GtfsRealtime.FeedHeader.newBuilder()
                .setGtfsRealtimeVersion("2.0")
                .setTimestamp(java.time.Instant.now().getEpochSecond())
                .build();
    }

    private static GtfsRealtime.FeedEntity entityWith(String entityId, String routeId, String vehicleId) {
        GtfsRealtime.VehiclePosition.Builder vb = GtfsRealtime.VehiclePosition.newBuilder();
        if (vehicleId != null) {
            vb.setVehicle(GtfsRealtime.VehicleDescriptor.newBuilder().setId(vehicleId).build());
        }
        GtfsRealtime.TripDescriptor.Builder tb = GtfsRealtime.TripDescriptor.newBuilder();
        if (routeId != null) {
            tb.setRouteId(routeId);
        }
        vb.setTrip(tb.build());
        return GtfsRealtime.FeedEntity.newBuilder().setId(entityId).setVehicle(vb.build()).build();
    }

    private static GtfsRtProperties propertiesFor(String url) {
        // Tests prime the snapshot directly so the cache never
        // calls fetchAndParse — supply a dummy URL set and the
        // default timeout.
        return new GtfsRtProperties(url, url, url, "", "", "", 10);
    }
}
