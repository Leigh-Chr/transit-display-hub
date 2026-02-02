package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;

import java.time.LocalTime;
import java.util.UUID;

public record ScheduleResponse(
        UUID id,
        LocalTime time,
        UUID stopId,
        ItineraryInfo itinerary
) {
    public record LineInfo(UUID id, String code, String name, String color) {}
    public record ItineraryInfo(UUID id, String name, String terminusName, LineInfo line) {}

    public static ScheduleResponse from(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        Line line = itinerary.getLine();
        LineInfo lineInfo = new LineInfo(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor()
        );
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
