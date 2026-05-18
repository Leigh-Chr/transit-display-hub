package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DataOverviewResponse;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import com.transit.hub.infrastructure.realtime.RealtimeTripUpdateCache;
import com.transit.hub.infrastructure.realtime.RealtimeVehiclePositionCache;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;

/**
 * Reports the live size of the three GTFS-Realtime caches plus their
 * enabled flag. Extracted from {@code DataOverviewService} so the
 * aggregator does not have to know how realtime is wired.
 */
@Component
@RequiredArgsConstructor
public class RealtimeOverviewProvider {

    private final RealtimeAlertCache alertCache;
    private final RealtimeTripUpdateCache tripUpdateCache;
    private final RealtimeVehiclePositionCache vehiclePositionCache;
    private final Clock clock;

    public DataOverviewResponse.Realtime snapshot() {
        return new DataOverviewResponse.Realtime(
                alertCache.activeAlerts(Instant.now(clock)).size(),
                tripUpdateCache.snapshotSize(),
                vehiclePositionCache.currentSnapshot().size(),
                alertCache.isEnabled(),
                tripUpdateCache.isEnabled(),
                vehiclePositionCache.isEnabled()
        );
    }
}
