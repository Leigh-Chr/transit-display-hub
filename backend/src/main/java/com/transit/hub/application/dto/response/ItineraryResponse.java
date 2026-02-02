package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record ItineraryResponse(
        UUID id,
        String name,
        String terminusName,
        LineInfo line,
        List<ItineraryStopInfo> stops
) {
    public record LineInfo(UUID id, String code, String name, String color) {}

    public record ItineraryStopInfo(UUID id, String name, int position) {}

    public static ItineraryResponse from(Itinerary itinerary) {
        Line line = itinerary.getLine();
        LineInfo lineInfo = new LineInfo(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor()
        );

        List<ItineraryStopInfo> stopInfos = itinerary.getItineraryStops().stream()
                .sorted(Comparator.comparing(ItineraryStop::getPosition))
                .map(is -> {
                    Stop stop = is.getStop();
                    return new ItineraryStopInfo(stop.getId(), stop.getName(), is.getPosition());
                })
                .toList();

        return new ItineraryResponse(
                itinerary.getId(),
                itinerary.getName(),
                itinerary.getTerminusName(),
                lineInfo,
                stopInfos
        );
    }
}
