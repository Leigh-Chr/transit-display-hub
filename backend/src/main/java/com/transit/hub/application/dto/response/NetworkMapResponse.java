package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.MessageSeverity;

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
            List<List<UUID>> itineraries
    ) {}

    public record NetworkStop(
            UUID id,
            String name,
            Double latitude,
            Double longitude,
            Double schematicX,
            Double schematicY,
            List<String> lineCodes
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
