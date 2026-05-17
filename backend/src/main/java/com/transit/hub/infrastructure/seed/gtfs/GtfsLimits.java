package com.transit.hub.infrastructure.seed.gtfs;

/**
 * Shared GTFS importer limits. Lives in one place so a tweak to a column
 * truncation budget never silently drifts between section importers.
 */
public final class GtfsLimits {

    public static final int LINE_NAME_MAX_LENGTH = 100;

    private GtfsLimits() {}
}
