-- The route-level continuous_pickup / continuous_drop_off settings on
-- Line cover most feeds, but the spec also lets a single stop_times
-- row override the route-level value. Without these columns, an
-- override at the stop_time level was silently dropped.
--
-- shape_dist_traveled on stop_times records how far along the shape a
-- given stop sits, useful for animating an in-progress vehicle on the
-- schematic without re-deriving the distance from coordinates.

ALTER TABLE schedules
    ADD COLUMN continuous_pickup SMALLINT,
    ADD COLUMN continuous_drop_off SMALLINT,
    ADD COLUMN shape_dist_traveled DOUBLE PRECISION;
