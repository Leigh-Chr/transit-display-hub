/**
 * Internal transfer objects produced by the GTFS import pipeline —
 * cross-importer payloads (stop import results, itinerary blueprints,
 * service-calendar snapshots, frequency windows) that don't belong on
 * the domain model. {@code @NullMarked} so the optional GTFS fields
 * the importers cope with surface explicitly as
 * {@link org.jspecify.annotations.Nullable}.
 */
@NullMarked
package com.transit.hub.infrastructure.seed.gtfs.model;

import org.jspecify.annotations.NullMarked;
