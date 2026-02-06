package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Schedule;

import java.time.LocalTime;
import java.util.UUID;

public record ScheduleResponse(
        UUID id,
        LocalTime time,
        UUID stopId,
        ItineraryInfo itinerary
) {
    public record ItineraryInfo(UUID id, String name, String terminusName, LineInfo line) {}

    public static ScheduleResponse from(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        LineInfo lineInfo = LineInfo.from(itinerary.getLine());
        ItineraryInfo itineraryInfo = new ItineraryInfo(
                itinerary.getId(),
                itinerary.getName(),
                itinerary.getTerminusName(),
                lineInfo
        );
        return new ScheduleResponse(
                schedule.getId(),
                schedule.getTime(),
                schedule.getStop().getId(),
                itineraryInfo
        );
    }
}
