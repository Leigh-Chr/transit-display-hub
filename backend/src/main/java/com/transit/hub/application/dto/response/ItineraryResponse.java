package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.CarsAllowed;
import org.jspecify.annotations.Nullable;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record ItineraryResponse(
        UUID id,
        String name,
        @Nullable String terminusName,
        @Nullable Short directionId,
        /** GTFS {@code trips.cars_allowed} default for the itinerary —
         *  derived from the majority value across this (route, direction)'s
         *  trips. Mostly relevant on motorail / ferry services. */
        @Nullable CarsAllowed carsAllowedDefault,
        /** GTFS {@code trips.safe_duration_factor} on the representative
         *  trip — multiplier applied to timetabled duration when
         *  estimating an on-demand ETA. Null when undeclared. */
        @Nullable Double safeDurationFactor,
        /** GTFS {@code trips.safe_duration_offset} on the representative
         *  trip — additive seconds layered on top of the factor. */
        @Nullable Double safeDurationOffset,
        LineInfo line,
        List<ItineraryStopInfo> stops
) {
    public record ItineraryStopInfo(UUID id, String name, int position) {}

    public static ItineraryResponse from(Itinerary itinerary) {
        LineInfo lineInfo = LineInfo.from(itinerary.getLine());

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
                itinerary.getDirectionId(),
                itinerary.getCarsAllowedDefault(),
                itinerary.getSafeDurationFactor(),
                itinerary.getSafeDurationOffset(),
                lineInfo,
                stopInfos
        );
    }
}
