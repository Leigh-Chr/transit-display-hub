package com.transit.hub.application.dto.response;

import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;

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
    public static RealtimeAlertResponse from(RealtimeAlertCache.AlertSnapshot snap) {
        return new RealtimeAlertResponse(
                snap.id(),
                List.copyOf(snap.routeExternalIds()),
                List.copyOf(snap.stopExternalIds()),
                List.copyOf(snap.agencyExternalIds()),
                snap.headerText(),
                snap.descriptionText(),
                snap.url(),
                snap.cause() != null ? snap.cause().name() : null,
                snap.effect() != null ? snap.effect().name() : null,
                snap.severity() != null ? snap.severity().name() : null
        );
    }
}
