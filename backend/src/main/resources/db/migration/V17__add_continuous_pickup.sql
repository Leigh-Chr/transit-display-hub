-- Phase 1.8: capture routes.continuous_pickup / continuous_drop_off.
-- A non-zero non-default value flags hop-on/hop-off service (passengers
-- can board or alight anywhere along the route segment), which the
-- stop popup and route-finder can surface as a service-kind hint.
--
-- The fields belong to the route in GTFS, so we store them on Line
-- rather than Itinerary — every itinerary derived from the same route
-- inherits the same value.

ALTER TABLE lines ADD COLUMN continuous_pickup   SMALLINT NOT NULL DEFAULT 1;
ALTER TABLE lines ADD COLUMN continuous_drop_off SMALLINT NOT NULL DEFAULT 1;
