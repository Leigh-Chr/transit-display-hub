package com.transit.hub.infrastructure.seed.gtfs.model;

/**
 * Composite key used to group trips and itineraries by (route_id, direction_id).
 */
public record RouteDirKey(String routeId, String directionId) {}
