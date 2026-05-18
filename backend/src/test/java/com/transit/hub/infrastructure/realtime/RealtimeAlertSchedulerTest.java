package com.transit.hub.infrastructure.realtime;

import com.transit.hub.infrastructure.config.GtfsRtProperties;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class RealtimeAlertSchedulerTest {

    private RealtimeAlertCache alertCache;
    private RealtimeTripUpdateCache tripUpdateCache;
    private RealtimeVehiclePositionCache vehicleCache;
    private GtfsRtProperties properties;
    private RealtimeAlertScheduler scheduler;

    @BeforeEach
    void setUp() {
        alertCache = mock(RealtimeAlertCache.class);
        tripUpdateCache = mock(RealtimeTripUpdateCache.class);
        vehicleCache = mock(RealtimeVehiclePositionCache.class);
        properties = mock(GtfsRtProperties.class);
        scheduler = new RealtimeAlertScheduler(alertCache, tripUpdateCache, vehicleCache, properties);
    }

    @Test
    void refreshOnStartup_primesEveryEnabledCache() {
        when(alertCache.isEnabled()).thenReturn(true);
        when(tripUpdateCache.isEnabled()).thenReturn(true);
        when(vehicleCache.isEnabled()).thenReturn(true);
        when(properties.alertsUrl()).thenReturn("http://a");
        when(properties.tripUpdatesUrl()).thenReturn("http://t");
        when(properties.vehiclePositionsUrl()).thenReturn("http://v");

        scheduler.refreshOnStartup();

        verify(alertCache).refresh();
        verify(tripUpdateCache).refresh();
        verify(vehicleCache).refresh();
    }

    @Test
    void refreshOnStartup_skipsDisabledCaches() {
        when(alertCache.isEnabled()).thenReturn(false);
        when(tripUpdateCache.isEnabled()).thenReturn(false);
        when(vehicleCache.isEnabled()).thenReturn(false);

        scheduler.refreshOnStartup();

        verify(alertCache, never()).refresh();
        verify(tripUpdateCache, never()).refresh();
        verify(vehicleCache, never()).refresh();
    }

    @Test
    void scheduledAlertRefresh_callsRefreshWhenEnabled() {
        when(alertCache.isEnabled()).thenReturn(true);
        scheduler.scheduledAlertRefresh();
        verify(alertCache).refresh();
    }

    @Test
    void scheduledAlertRefresh_skipsWhenDisabled() {
        when(alertCache.isEnabled()).thenReturn(false);
        scheduler.scheduledAlertRefresh();
        verify(alertCache, never()).refresh();
    }

    @Test
    void scheduledTripUpdateRefresh_callsRefreshWhenEnabled() {
        when(tripUpdateCache.isEnabled()).thenReturn(true);
        scheduler.scheduledTripUpdateRefresh();
        verify(tripUpdateCache).refresh();
    }

    @Test
    void scheduledTripUpdateRefresh_skipsWhenDisabled() {
        when(tripUpdateCache.isEnabled()).thenReturn(false);
        scheduler.scheduledTripUpdateRefresh();
        verify(tripUpdateCache, never()).refresh();
    }

    @Test
    void scheduledVehiclePositionRefresh_callsRefreshWhenEnabled() {
        when(vehicleCache.isEnabled()).thenReturn(true);
        scheduler.scheduledVehiclePositionRefresh();
        verify(vehicleCache).refresh();
    }

    @Test
    void scheduledVehiclePositionRefresh_skipsWhenDisabled() {
        when(vehicleCache.isEnabled()).thenReturn(false);
        scheduler.scheduledVehiclePositionRefresh();
        verify(vehicleCache, never()).refresh();
    }
}
