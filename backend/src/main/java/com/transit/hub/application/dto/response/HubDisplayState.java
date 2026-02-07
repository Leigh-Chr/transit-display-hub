package com.transit.hub.application.dto.response;

import java.time.Instant;
import java.time.LocalTime;
import java.util.List;

public record HubDisplayState(
        String hubName,
        List<LineInfo> lines,
        List<HubArrivalInfo> arrivals,
        List<DisplayState.MessageInfo> messages,
        long version,
        Instant generatedAt
) {
    public record HubArrivalInfo(
            LocalTime scheduledTime,
            String destinationName,
            String platform,
            LineInfo line
    ) {}
}
