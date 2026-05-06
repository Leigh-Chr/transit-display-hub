package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.model.enums.PickupKind;

import java.time.Instant;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

public record DisplayState(
        UUID stopId,
        String stopName,
        /** GTFS platform_code for stops that publish one (railway feeds,
         *  hub kiosks). Null on bus poles and any stop without a platform
         *  designation. */
        String stopPlatformCode,
        List<LineInfo> lines,
        List<ArrivalInfo> arrivals,
        List<MessageInfo> messages,
        long version,
        Instant generatedAt
) {
    public record ArrivalInfo(
            LocalTime scheduledTime,
            String destinationName,
            LineInfo line,
            PickupKind pickupKind,
            com.transit.hub.domain.model.enums.WheelchairAccess wheelchairAccessible,
            com.transit.hub.domain.model.enums.BikesAllowed bikesAllowed,
            boolean timepoint,
            /** Headway from frequencies.txt when applicable. The kiosk
             *  surfaces it as "every X min" so passengers don't expect
             *  a strict timetable on high-frequency lines. */
            Integer frequencyHeadwaySeconds
    ) {}

    public record MessageInfo(
            String title,
            String content,
            MessageSeverity severity
    ) {}
}
