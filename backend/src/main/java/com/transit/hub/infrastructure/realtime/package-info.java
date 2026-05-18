/**
 * GTFS-Realtime ingestion — generic FeedMessage downloader plus
 * specialised caches for service alerts, trip updates and vehicle
 * positions. Snapshots are recomputed atomically so passenger surfaces
 * always read a consistent view. {@code @NullMarked} so the optional
 * Protobuf fields (header timestamp, incrementality, per-stop time
 * updates, vehicle GPS extras) surface as
 * {@link org.jspecify.annotations.Nullable}.
 */
@NullMarked
package com.transit.hub.infrastructure.realtime;

import org.jspecify.annotations.NullMarked;
