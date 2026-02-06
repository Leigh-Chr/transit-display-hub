package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.MessageSeverity;

import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record DisplayState(
        UUID stopId,
        String stopName,
        List<LineInfo> lines,
        List<ArrivalInfo> arrivals,
        List<MessageInfo> messages,
        long version,
        Instant generatedAt
) {
    public record ArrivalInfo(
            LocalTime scheduledTime,
            String destinationName,
            LineInfo line
    ) {}

    public record MessageInfo(
            String title,
            String content,
            MessageSeverity severity
    ) {}
}
