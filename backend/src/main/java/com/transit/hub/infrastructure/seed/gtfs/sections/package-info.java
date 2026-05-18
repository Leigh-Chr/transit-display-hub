/**
 * Per-section CSV importers — each one consumes one GTFS file (agencies,
 * routes, stops, itineraries, schedules, fares, locations, pathways…)
 * and writes to the matching repository. Shared helpers
 * ({@code CsvHelper}, etc.) live alongside. {@code @NullMarked} so the
 * GTFS-optional column reads surface as
 * {@link org.jspecify.annotations.Nullable}.
 */
@NullMarked
package com.transit.hub.infrastructure.seed.gtfs.sections;

import org.jspecify.annotations.NullMarked;
