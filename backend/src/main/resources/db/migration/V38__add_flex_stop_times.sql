-- GTFS-flex stop_times rows are not arrivals at a fixed stop — they
-- describe a pickup/drop-off window covering a polygon (location_id) or
-- a set of stops (location_group_id). The spec makes them mutually
-- exclusive with the regular (stop_id, arrival_time, departure_time)
-- triple, so storing them on the same `schedules` row would mean
-- making half its columns nullable and validating an XOR at the
-- application layer. A dedicated table keeps `schedules` honest as
-- "concrete arrival/departure" and exposes the flex side cleanly to
-- consumers that ask about on-demand service.

CREATE TABLE flex_stop_times (
    id UUID PRIMARY KEY,
    itinerary_id UUID NOT NULL,
    stop_sequence INTEGER NOT NULL,
    -- Exactly one of the three target columns is non-null on import,
    -- enforced by GtfsImportService. We keep them as plain FKs so the
    -- ORM can join lazily for callers that need the geometry / member
    -- stops.
    stop_id UUID,
    location_id UUID,
    location_group_id UUID,
    start_pickup_drop_off_window TIME NOT NULL,
    end_pickup_drop_off_window TIME NOT NULL,
    pickup_type SMALLINT,
    drop_off_type SMALLINT,
    pickup_booking_rule_id UUID,
    drop_off_booking_rule_id UUID,
    service_calendar_id UUID,
    stop_headsign VARCHAR(100),
    CONSTRAINT fk_flex_stop_time_itinerary
        FOREIGN KEY (itinerary_id) REFERENCES itineraries(id) ON DELETE CASCADE,
    CONSTRAINT fk_flex_stop_time_stop
        FOREIGN KEY (stop_id) REFERENCES stops(id) ON DELETE SET NULL,
    CONSTRAINT fk_flex_stop_time_location
        FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
    CONSTRAINT fk_flex_stop_time_location_group
        FOREIGN KEY (location_group_id) REFERENCES location_groups(id) ON DELETE SET NULL,
    CONSTRAINT fk_flex_stop_time_pickup_booking
        FOREIGN KEY (pickup_booking_rule_id) REFERENCES booking_rules(id) ON DELETE SET NULL,
    CONSTRAINT fk_flex_stop_time_dropoff_booking
        FOREIGN KEY (drop_off_booking_rule_id) REFERENCES booking_rules(id) ON DELETE SET NULL,
    CONSTRAINT fk_flex_stop_time_service_calendar
        FOREIGN KEY (service_calendar_id) REFERENCES service_calendars(id) ON DELETE SET NULL
);

CREATE INDEX idx_flex_stop_time_itinerary ON flex_stop_times(itinerary_id);
CREATE INDEX idx_flex_stop_time_location ON flex_stop_times(location_id);
CREATE INDEX idx_flex_stop_time_location_group ON flex_stop_times(location_group_id);
CREATE INDEX idx_flex_stop_time_window ON flex_stop_times(start_pickup_drop_off_window, end_pickup_drop_off_window);
