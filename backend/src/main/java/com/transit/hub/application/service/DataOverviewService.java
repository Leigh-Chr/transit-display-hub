package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DataOverviewResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

/**
 * Aggregates the static GTFS counts and the realtime cache snapshot
 * into the single payload consumed by the admin dashboard. The actual
 * counting is delegated to two cohesive providers so this class stays
 * a thin stitcher rather than a sixteen-repo god service.
 */
@Service
@RequiredArgsConstructor
public class DataOverviewService {

    private final StaticGtfsOverviewProvider staticGtfsOverview;
    private final RealtimeOverviewProvider realtimeOverview;

    public DataOverviewResponse current() {
        return new DataOverviewResponse(
                staticGtfsOverview.snapshot(),
                realtimeOverview.snapshot()
        );
    }
}
