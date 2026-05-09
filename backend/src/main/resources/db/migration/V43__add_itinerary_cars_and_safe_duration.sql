-- Spec additions to trips.txt that landed after the project's V1
-- import path was written:
--   - cars_allowed: tri-state policy for motorail / ferry services
--     that carry passenger cars
--   - safe_duration_factor / safe_duration_offset: multiplier and
--     constant offset describing how to inflate the timetabled
--     duration into a "safe" duration for on-demand booking
--     estimation
--
-- Stored per itinerary as defaults derived from the representative
-- trip — the same way wheelchair_default and bikes_allowed_default
-- are sourced.

ALTER TABLE itineraries
    ADD COLUMN cars_allowed_default VARCHAR(20),
    ADD COLUMN safe_duration_factor DOUBLE PRECISION,
    ADD COLUMN safe_duration_offset DOUBLE PRECISION;
