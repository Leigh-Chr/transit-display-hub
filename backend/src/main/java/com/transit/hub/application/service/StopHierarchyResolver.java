package com.transit.hub.application.service;

import com.transit.hub.domain.model.Stop;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Pure helper that resolves parent/platform relationships across a collection of stops.
 * Extracted from {@link NetworkMapService} so the network map service and the alerts
 * service can both collapse children under their parent station without duplicating
 * the traversal.
 */
@Component
public class StopHierarchyResolver {

    /**
     * Returns a {@code platformId → parentStopId} lookup for every stop with a parent.
     * Stops without a parent are skipped (no self-mapping). Phase 1.3: the importer
     * attaches itinerary stops to actual platforms but the schematic map only surfaces
     * parent stations, so the resulting map lets itineraries and transfers rewrite
     * their stop ids consistently with the surface stop list.
     */
    public Map<UUID, UUID> buildPlatformToParentMap(List<Stop> stops) {
        Map<UUID, UUID> map = new HashMap<>();
        for (Stop s : stops) {
            if (s.getParentStop() != null) {
                map.put(s.getId(), s.getParentStop().getId());
            }
        }
        return map;
    }

    /**
     * Groups every child platform under its parent's stop id. Standalone stops (no
     * parent) do not appear as keys, which lets {@code buildNetworkStops} skip them
     * cleanly when iterating parent → children.
     */
    public Map<UUID, List<Stop>> buildChildrenByParentId(List<Stop> stops) {
        return stops.stream()
                .filter(stop -> stop.getParentStop() != null)
                .collect(Collectors.groupingBy(stop -> stop.getParentStop().getId()));
    }
}
