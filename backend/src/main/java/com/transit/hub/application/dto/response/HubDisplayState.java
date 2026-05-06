package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.PickupKind;

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
            LineInfo line,
            PickupKind pickupKind,
            com.transit.hub.domain.model.enums.WheelchairAccess wheelchairAccessible,
            com.transit.hub.domain.model.enums.BikesAllowed bikesAllowed,
            boolean timepoint,
            Integer frequencyHeadwaySeconds
    ) {}
}
