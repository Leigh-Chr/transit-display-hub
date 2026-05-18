/**
 * Enum types mirroring GTFS-defined coded fields. {@code @NullMarked}
 * keeps the {@code fromGtfsCode} factories honest — the {@code @Nullable}
 * return annotation surfaces the "unknown code" path the spec leaves
 * open for forward-compatibility.
 */
@NullMarked
package com.transit.hub.domain.model.enums;

import org.jspecify.annotations.NullMarked;
