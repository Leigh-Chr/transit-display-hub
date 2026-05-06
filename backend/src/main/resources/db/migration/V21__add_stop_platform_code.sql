-- Phase 1.3: store the platform code printed on the physical signpost
-- when the GTFS feed publishes one at root level (typical of railway
-- feeds where each track has its own stops.txt row with a parent_station
-- referenced by the user-facing label).
--
-- Limited to the current import behaviour — boarding-area children
-- (location_type=4) are still collapsed into their root in this phase,
-- so multi-platform stations get the platform_code of whichever child
-- happened to publish one. Full per-platform display lives in a follow-up
-- when the importStops refactor lands.

ALTER TABLE stops ADD COLUMN platform_code VARCHAR(10);
