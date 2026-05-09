package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.FlexStopTime;

import java.time.LocalTime;
import java.util.UUID;

/**
 * Read-only view of a {@link FlexStopTime}: a GTFS-flex stop_time row
 * that defines a pickup/drop-off window over a polygon, a group of
 * stops, or a single stop. Carries enough denormalised context
 * (itinerary, line, target name) for an admin browse page to render
 * without N+1 lookups.
 */
public record FlexStopTimeResponse(
        UUID id,
        UUID itineraryId,
        String itineraryName,
        String lineCode,
        String lineColor,
        Integer stopSequence,
        /** UUID of the target {@code Stop}, when the row uses stop_id. */
        UUID stopId,
        String stopName,
        /** External id of the target {@code Location} (GeoJSON feature id),
         *  when the row uses location_id. */
        String locationExternalId,
        String locationName,
        /** External id of the target {@code LocationGroup}, when the row
         *  uses location_group_id. */
        String locationGroupExternalId,
        String locationGroupName,
        LocalTime startPickupDropOffWindow,
        LocalTime endPickupDropOffWindow,
        Short pickupType,
        Short dropOffType,
        UUID pickupBookingRuleId,
        String pickupBookingRuleExternalId,
        UUID dropOffBookingRuleId,
        String dropOffBookingRuleExternalId,
        UUID serviceCalendarId,
        String serviceCalendarExternalId,
        String stopHeadsign
) {
    public static FlexStopTimeResponse from(FlexStopTime f) {
        var line = f.getItinerary() != null ? f.getItinerary().getLine() : null;
        return new FlexStopTimeResponse(
                f.getId(),
                f.getItinerary() != null ? f.getItinerary().getId() : null,
                f.getItinerary() != null ? f.getItinerary().getName() : null,
                line != null ? line.getCode() : null,
                line != null ? line.getColor() : null,
                f.getStopSequence(),
                f.getStop() != null ? f.getStop().getId() : null,
                f.getStop() != null ? f.getStop().getName() : null,
                f.getLocation() != null ? f.getLocation().getExternalId() : null,
                f.getLocation() != null ? f.getLocation().getName() : null,
                f.getLocationGroup() != null ? f.getLocationGroup().getExternalId() : null,
                f.getLocationGroup() != null ? f.getLocationGroup().getGroupName() : null,
                f.getStartPickupDropOffWindow(),
                f.getEndPickupDropOffWindow(),
                f.getPickupType(),
                f.getDropOffType(),
                f.getPickupBookingRule() != null ? f.getPickupBookingRule().getId() : null,
                f.getPickupBookingRule() != null ? f.getPickupBookingRule().getExternalId() : null,
                f.getDropOffBookingRule() != null ? f.getDropOffBookingRule().getId() : null,
                f.getDropOffBookingRule() != null ? f.getDropOffBookingRule().getExternalId() : null,
                f.getServiceCalendar() != null ? f.getServiceCalendar().getId() : null,
                f.getServiceCalendar() != null ? f.getServiceCalendar().getExternalId() : null,
                f.getStopHeadsign()
        );
    }
}
