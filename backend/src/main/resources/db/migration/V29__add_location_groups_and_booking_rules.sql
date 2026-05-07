-- Phase 5.3 light: persist GTFS demand-responsive transit (TAD)
-- artefacts — location groups (a bundle of stops a flexible service
-- treats as one boarding zone) and booking rules (how to phone/URL
-- the operator with how much notice).
--
-- Out of scope for this migration:
--   - locations.geojson (free-form pickup polygons),
--   - stop_areas (alternative grouping mechanism),
--   - per-stop_time pickup_booking_rule_id / drop_off_booking_rule_id
--     FKs — those would touch the schedules hot-path and need a
--     passenger surface to justify the column count.
-- The current migration is purely additive.

CREATE TABLE location_groups (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    group_name VARCHAR(200)
);

CREATE TABLE location_group_stops (
    location_group_id UUID NOT NULL REFERENCES location_groups(id) ON DELETE CASCADE,
    stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    PRIMARY KEY (location_group_id, stop_id)
);

CREATE INDEX idx_location_group_stops_stop ON location_group_stops(stop_id);

CREATE TABLE booking_rules (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    booking_type VARCHAR(20) NOT NULL,
    prior_notice_duration_min INT,
    prior_notice_duration_max INT,
    prior_notice_last_day INT,
    prior_notice_last_time TIME,
    prior_notice_start_day INT,
    phone VARCHAR(30),
    booking_url VARCHAR(500),
    info_url VARCHAR(500),
    message VARCHAR(1000)
);
