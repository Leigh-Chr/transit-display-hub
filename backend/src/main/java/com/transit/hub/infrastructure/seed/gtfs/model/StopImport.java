package com.transit.hub.infrastructure.seed.gtfs.model;

import com.transit.hub.domain.model.Stop;

import java.util.Map;

/**
 * Persisted-stop lookup keyed by the GTFS {@code stop_id}. Passed from
 * {@code StopImporter} to downstream importers (schedules, pathways,
 * transfers, location groups, fare leg join rules, areas).
 */
public record StopImport(Map<String, Stop> stopsByGtfsId) {}
