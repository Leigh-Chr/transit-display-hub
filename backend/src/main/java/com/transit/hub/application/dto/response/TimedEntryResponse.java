package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.TimedEntry;

import java.time.LocalTime;
import java.util.UUID;

public record TimedEntryResponse(
        UUID id,
        LocalTime time,
        UUID stopId
) {
    public static TimedEntryResponse from(TimedEntry entry) {
        return new TimedEntryResponse(
                entry.getId(),
                entry.getTime(),
                entry.getStop().getId()
        );
    }
}
