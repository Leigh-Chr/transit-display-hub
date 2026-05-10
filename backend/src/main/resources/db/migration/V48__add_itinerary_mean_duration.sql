-- GTFS-flex 2024 spec adds two trips.txt fields used to predict the
-- average dwell time of a flexible (point-to-point or zone-to-zone)
-- segment, alongside the safe_duration_* pair already persisted via
-- V36. They are both optional and nullable.
--
--   mean_duration_factor   multiplier applied to the timetabled duration
--   mean_duration_offset   additive constant in seconds
--
-- The kiosk popup uses these to surface a realistic ETA on flex
-- segments instead of falling back to the schedule midpoint.

ALTER TABLE itineraries
    ADD COLUMN mean_duration_factor DOUBLE PRECISION,
    ADD COLUMN mean_duration_offset DOUBLE PRECISION;
