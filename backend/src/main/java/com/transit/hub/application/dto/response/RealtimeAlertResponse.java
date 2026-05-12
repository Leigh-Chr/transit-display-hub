package com.transit.hub.application.dto.response;

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
        String headerText,
        String descriptionText,
        String url,
        String cause,
        String effect,
        String severity
) {
}
