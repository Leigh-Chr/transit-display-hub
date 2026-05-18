package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Schedule;
import org.jspecify.annotations.Nullable;

import java.time.LocalTime;
import java.util.UUID;

public record ScheduleResponse(
        UUID id,
        LocalTime time,
        UUID stopId,
        ItineraryInfo itinerary,
        @Nullable Short continuousPickup,
        @Nullable Short continuousDropOff,
        @Nullable Double shapeDistTraveled
) {
    public record ItineraryInfo(UUID id, String name, @Nullable String terminusName,
                                @Nullable Short directionId, LineInfo line) {}

    public static ScheduleResponse from(Schedule schedule) {
        Itinerary itinerary = schedule.getItinerary();
        LineInfo lineInfo = LineInfo.from(itinerary.getLine());
        ItineraryInfo itineraryInfo = new ItineraryInfo(
                itinerary.getId(),
                itinerary.getName(),
                itinerary.getTerminusName(),
                itinerary.getDirectionId(),
                lineInfo
        );
        return new ScheduleResponse(
                schedule.getId(),
                schedule.getTime(),
                schedule.getStop().getId(),
                itineraryInfo,
                schedule.getContinuousPickup(),
                schedule.getContinuousDropOff(),
                schedule.getShapeDistTraveled()
        );
    }
}
