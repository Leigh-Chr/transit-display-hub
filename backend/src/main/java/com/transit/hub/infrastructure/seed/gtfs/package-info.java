/**
 * Static-GTFS ingestion pipeline — feed download, parse-orchestrator,
 * raw-row helpers, dev-only seed loader. {@code @NullMarked} so the
 * optional CSV columns and HTTP response headers the importers tolerate
 * surface explicitly as {@link org.jspecify.annotations.Nullable}.
 */
@NullMarked
package com.transit.hub.infrastructure.seed.gtfs;

import org.jspecify.annotations.NullMarked;
