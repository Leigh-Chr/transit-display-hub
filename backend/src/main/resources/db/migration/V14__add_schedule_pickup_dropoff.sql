-- Phase 1.6: capture stop_times.pickup_type / drop_off_type so the kiosk
-- can flag arrivals that need a phone reservation, that won't pick up
-- passengers (drop-off only) or that won't drop off (pick-up only).
-- The (pickup=1 AND dropoff=1) "no service" combination is filtered out
-- at import time and never reaches a Schedule row.

ALTER TABLE schedules ADD COLUMN pickup_type   SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE schedules ADD COLUMN drop_off_type SMALLINT NOT NULL DEFAULT 0;
