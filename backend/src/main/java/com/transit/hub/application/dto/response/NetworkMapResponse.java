package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.model.enums.MessageSeverity;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record NetworkMapResponse(
        List<NetworkLine> lines,
        List<NetworkStop> stops,
        Bounds bounds,
        String attribution
) {
    public record NetworkLine(
            UUID id,
            String code,
            String name,
            String color,
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
