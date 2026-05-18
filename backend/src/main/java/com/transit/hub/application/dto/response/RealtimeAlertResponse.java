package com.transit.hub.application.dto.response;

import org.jspecify.annotations.Nullable;

import java.util.List;

/**
 * Read-only DTO over a GTFS-Realtime service alert. Carries the
 * relevant fields without forcing the caller to depend on the
 * Protobuf-generated classes.
 */
public record RealtimeAlertResponse(
        String id,
        List<String> routeIds,
        List<String> stopIds,
        List<String> agencyIds,
        @Nullable String headerText,
        @Nullable String descriptionText,
        @Nullable String url,
        @Nullable String cause,
        @Nullable String effect,
        @Nullable String severity
) {
}
