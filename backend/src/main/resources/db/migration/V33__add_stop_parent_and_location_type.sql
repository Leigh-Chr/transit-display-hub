-- Phase 1.3 — per-platform Stop persistence.
--
-- The importer previously collapsed multi-platform stations to a
-- single row by walking parent_station chains and keeping only the
-- root. This forced every kiosk bound to e.g. "Saint-Lazare" to
-- aggregate four platforms into one merged display, and any feed
-- with platform_code data lost the per-platform granularity.
--
-- After this migration the importer persists each platform as its
-- own Stop with parent_stop_id pointing at its station, plus the
-- station itself. Schedules anchor to the actual platform; the
-- display calculator aggregates child platforms when a kiosk is
-- bound to a parent station, preserving existing device bindings.
--
-- ON DELETE behaviour:
--   - parent_stop_id SET NULL: dropping a station detaches its
--     platforms rather than cascading. The platforms keep their
--     schedules and devices; the link just unrefers.
--
-- location_type values (matching GTFS):
--   0 = stop / platform (default)
--   1 = station (parent)
--   2 = entrance / exit (not imported)
--   3 = generic node (not imported)
--   4 = boarding area (not imported)
-- Unknown / future values pass through as-is via the SMALLINT
-- column so a feed shipping a value > 4 won't break the import.

ALTER TABLE stops
    ADD COLUMN parent_stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
    ADD COLUMN location_type SMALLINT NOT NULL DEFAULT 0;

CREATE INDEX idx_stops_parent ON stops(parent_stop_id);
CREATE INDEX idx_stops_location_type ON stops(location_type);
