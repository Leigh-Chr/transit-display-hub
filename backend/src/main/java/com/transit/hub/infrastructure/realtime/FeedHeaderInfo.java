package com.transit.hub.infrastructure.realtime;

import org.jspecify.annotations.Nullable;

/**
 * GTFS-Realtime {@code FeedHeader} fields captured at parse time so a
 * downstream consumer can validate the freshness of a feed and detect
 * differential updates.
 *
 * <ul>
 *   <li>{@code timestampEpochSeconds} — wall-clock time at which the
 *       feed was published. Null when the producer omits it.</li>
 *   <li>{@code incrementality} — {@code FULL_DATASET} or
 *       {@code DIFFERENTIAL}, captured as the protobuf enum name so
 *       consumers don't have to depend on the {@code GtfsRealtime}
 *       generated types.</li>
 *   <li>{@code version} — the {@code gtfs_realtime_version} string the
 *       producer ships, typically {@code "2.0"}.</li>
 * </ul>
 *
 * <p>The record is shared across the three feed caches (alerts, trip
 * updates, vehicle positions) — each one publishes its own header
 * because the three feeds are independent transports with independent
 * publication schedules.
 */
public record FeedHeaderInfo(
        @Nullable Long timestampEpochSeconds,
        @Nullable String incrementality,
        @Nullable String version) {

    /** Empty header used as the initial snapshot before the first
     *  successful refresh. */
    public static FeedHeaderInfo empty() {
        return new FeedHeaderInfo(null, null, null);
    }
}
