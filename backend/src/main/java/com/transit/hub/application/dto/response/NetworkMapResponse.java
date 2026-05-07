package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.model.enums.WheelchairAccess;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record NetworkMapResponse(
        List<NetworkLine> lines,
        List<NetworkStop> stops,
        List<NetworkTransfer> transfers,
        Bounds bounds,
        String attribution
) {
    public record NetworkLine(
            UUID id,
            String code,
            String name,
            String color,
            String textColor,
            LineType type,
            String category,
            List<List<UUID>> itineraries,
            /** Aggregate schedule count for the line (across every
             *  itinerary, every stop, every service calendar). The
             *  schematic uses it to scale stroke-width — busier lines
             *  draw fatter. Zero is a legitimate value (admin-created
             *  line with no schedules) and renders at the minimum
             *  thickness. */
            long scheduleCount
    ) {}

    public record NetworkStop(
            UUID id,
            String name,
            Double latitude,
            Double longitude,
            Double schematicX,
            Double schematicY,
            List<String> lineCodes,
            /** GTFS wheelchair_boarding tri-state on the stop itself
             *  (or on its first wheelchair-accessible child for parent
             *  stations). Drives the accessibility filter and the
             *  pictogram in the popup. */
            WheelchairAccess wheelchairBoarding,
            /** True when at least one schedule on this stop (or any of
             *  its child platforms) requires booking — pickup_type 2
             *  (on-request agency) or 3 (on-request driver). The kiosk
             *  + map render a phone icon on these stops so passengers
             *  know not to wait without calling first. */
            boolean hasOnDemand,
            /** Names of every Fares v2 area this stop belongs to (or any
             *  of its child platforms when the stop is a parent station).
             *  Empty when the feed has no Fares v2 areas — the popup
             *  hides the zone pill in that case. Stored as names rather
             *  than ids because the popup is a leaf consumer; admins
             *  who need ids go through {@code /api/admin/fares-v2}. */
            List<String> fareAreaNames
    ) {}

    /** Inline transfer between two stops. {@code transferType} mirrors
     *  GTFS (0 recommended, 1 timed, 2 minimum-time, 3 not possible).
     *  {@code minTransferTimeSeconds} is null when the feed didn't
     *  publish one — consumers fall back to a reasonable default. */
    public record NetworkTransfer(
            UUID fromStopId,
            UUID toStopId,
            short transferType,
            Integer minTransferTimeSeconds
    ) {}

    public record Bounds(
            double minX,
            double minY,
            double maxX,
            double maxY
    ) {}

    public record AlertMessage(String title, String content, MessageSeverity severity) {}

    public record AlertsResponse(
            List<AlertMessage> networkAlerts,
            Map<UUID, List<AlertMessage>> lineAlerts,
            Map<UUID, List<AlertMessage>> stopAlerts
    ) {}
}
