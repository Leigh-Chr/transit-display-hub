-- Phase 5.2: persist trips.block_id on the schedule rows.
--
-- A block_id chains the consecutive trips a single physical vehicle
-- runs throughout the day (a bus serving line 12 outbound, then
-- line 12 inbound, then line 35 outbound — same driver, same vehicle).
-- Useful for operational analytics ("which scheduled departures share a
-- vehicle?") and a prerequisite for any future GTFS-RT vehicle matching.
-- No passenger-facing surface yet.

ALTER TABLE schedules ADD COLUMN block_id VARCHAR(40);

CREATE INDEX idx_schedules_block_id ON schedules(block_id);
