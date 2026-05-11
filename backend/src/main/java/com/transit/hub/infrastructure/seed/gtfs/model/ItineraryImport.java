package com.transit.hub.infrastructure.seed.gtfs.model;

import com.transit.hub.domain.model.Itinerary;

import java.util.Map;

/**
 * Result of the itinerary import step: the counts needed for the final
 * {@code ImportResult}, plus the in-memory indexes that downstream
 * importers (schedules) must resolve against.
 */
public record ItineraryImport(
        int itineraryCount,
        int itineraryStopCount,
        Map<String, TripInfo> tripInfos,
        Map<RouteDirKey, Itinerary> itinerariesByRouteDir) {}
