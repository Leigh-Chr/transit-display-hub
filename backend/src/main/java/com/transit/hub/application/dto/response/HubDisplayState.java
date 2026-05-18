package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.enums.PickupKind;
import org.jspecify.annotations.Nullable;

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
            @Nullable String destinationName,
            String platform,
            LineInfo line,
            PickupKind pickupKind,
            com.transit.hub.domain.model.enums.WheelchairAccess wheelchairAccessible,
            com.transit.hub.domain.model.enums.BikesAllowed bikesAllowed,
            boolean timepoint,
            @Nullable Integer frequencyHeadwaySeconds,
            /** Realtime delay applied to {@code scheduledTime} (seconds).
             *  Same semantics as {@link DisplayState.ArrivalInfo#realtimeDelaySeconds}. */
            @Nullable Integer realtimeDelaySeconds,
            /** TAD booking flow when this arrival's pickup is on-demand;
             *  null on regular fixed-route trips. */
            DisplayState.@Nullable BookingInfo booking
    ) {}
}
