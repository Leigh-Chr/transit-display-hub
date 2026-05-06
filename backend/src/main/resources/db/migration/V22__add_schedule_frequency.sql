-- Phase 2.3: capture frequencies.txt headway on the schedules of trips
-- declared in the file. We don't generate synthetic schedules here —
-- the importer keeps the representative-trip-only model and simply
-- annotates schedules whose source trip carries a headway, so the
-- kiosk can render "every 4 min" instead of (or alongside) the next
-- exact departure.
--
-- frequency_exact_times mirrors the GTFS column: false (default) means
-- the start time is approximate, true means exact_times applies.

ALTER TABLE schedules ADD COLUMN frequency_headway_seconds INTEGER;
ALTER TABLE schedules ADD COLUMN frequency_exact_times     BOOLEAN;
