package com.transit.hub.application.dto.response;

/**
 * One-shot snapshot of every persisted entity count plus the
 * realtime cache sizes. Lets the admin dashboard render a single
 * "what does this install have right now?" panel without firing
 * a dozen GETs.
 */
public record DataOverviewResponse(
        StaticGtfs staticGtfs,
        Realtime realtime
) {
    /** Counts of the persisted GTFS-Schedule entities. */
    public record StaticGtfs(
            long agencies,
            long lines,
            long stops,
            long disabledStops,
            long itineraries,
            long itineraryStops,
            long schedules,
            long serviceCalendars,
            long transfers,
            long shapes,
            long pathways,
            long stationLevels,
            long fareAttributes,
            long locationGroups,
            long bookingRules,
            long translations,
            long attributions
    ) {}

    /** Snapshot of the in-memory GTFS-Realtime caches. */
    public record Realtime(
            int alerts,
            int tripUpdates,
            int vehiclePositions,
            boolean alertsEnabled,
            boolean tripUpdatesEnabled,
            boolean vehiclePositionsEnabled
    ) {}
}
