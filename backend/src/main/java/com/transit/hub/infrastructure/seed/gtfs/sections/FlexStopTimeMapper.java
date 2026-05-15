package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Location;
import com.transit.hub.domain.model.LocationGroup;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.seed.gtfs.model.StopImport;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.time.LocalTime;
import java.util.Map;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseShortOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Builds a {@link FlexStopTime} from a {@code stop_times.txt} row whose
 * pickup/drop-off applies over a polygon ({@code location_id}) or a group
 * of stops ({@code location_group_id}). Spec dictates the three target
 * refs are mutually exclusive — we honour {@code location_id} over
 * {@code location_group_id} over {@code stop_id} when more than one is set,
 * but log nothing because feeds in the wild occasionally tag both for
 * redundancy.
 */
@Component
public class FlexStopTimeMapper {

    public FlexStopTime build(CSVRecord record, Itinerary itinerary,
                              ServiceCalendar calendar,
                              StopImport stopImport,
                              Map<String, Location> locations,
                              Map<String, LocationGroup> locationGroups,
                              Map<String, BookingRule> bookingRules,
                              LocalTime startWindow, LocalTime endWindow) {
        String locationId = optional(record, "location_id");
        String locationGroupId = optional(record, "location_group_id");
        String stopId = optional(record, "stop_id");
        Location location = isBlank(locationId) ? null : locations.get(locationId);
        LocationGroup locationGroup =
                (location == null && !isBlank(locationGroupId))
                        ? locationGroups.get(locationGroupId) : null;
        Stop stop = (location == null && locationGroup == null && !isBlank(stopId))
                ? stopImport.stopsByGtfsId().get(stopId) : null;

        Short pickupType = parseShortOrNull(optional(record, "pickup_type"));
        Short dropOffType = parseShortOrNull(optional(record, "drop_off_type"));
        BookingRule pickupBooking = bookingRules.get(optional(record, "pickup_booking_rule_id"));
        BookingRule dropOffBooking = bookingRules.get(optional(record, "drop_off_booking_rule_id"));
        Integer sequence = parseIntOrNull(optional(record, "stop_sequence"));

        return FlexStopTime.builder()
                .itinerary(itinerary)
                .stopSequence(sequence == null ? Integer.valueOf(0) : sequence)
                .stop(stop)
                .location(location)
                .locationGroup(locationGroup)
                .startPickupDropOffWindow(startWindow)
                .endPickupDropOffWindow(endWindow)
                .pickupType(pickupType)
                .dropOffType(dropOffType)
                .pickupBookingRule(pickupBooking)
                .dropOffBookingRule(dropOffBooking)
                .serviceCalendar(calendar)
                .stopHeadsign(truncate(optional(record, "stop_headsign"), 100))
                .build();
    }
}
