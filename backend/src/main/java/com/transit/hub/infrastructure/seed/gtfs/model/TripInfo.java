package com.transit.hub.infrastructure.seed.gtfs.model;

/**
 * In-memory representation of a GTFS {@code trips.txt} row, used during
 * itinerary selection and schedule fan-out.
 */
public record TripInfo(String routeId, String directionId, String serviceId, String headsign,
                       int wheelchairAccessible, int bikesAllowed, int carsAllowed,
                       Double safeDurationFactor, Double safeDurationOffset,
                       Double meanDurationFactor, Double meanDurationOffset,
                       String blockId) {}
