package com.transit.hub.infrastructure.seed.gtfs.model;

import org.jspecify.annotations.Nullable;

/**
 * In-memory representation of a GTFS {@code trips.txt} row, used during
 * itinerary selection and schedule fan-out.
 */
public record TripInfo(String routeId, String directionId, @Nullable String serviceId, @Nullable String headsign,
                       int wheelchairAccessible, int bikesAllowed, int carsAllowed,
                       @Nullable Double safeDurationFactor, @Nullable Double safeDurationOffset,
                       @Nullable Double meanDurationFactor, @Nullable Double meanDurationOffset,
                       @Nullable String blockId) {}
