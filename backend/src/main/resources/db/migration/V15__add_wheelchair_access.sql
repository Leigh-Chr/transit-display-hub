-- Phase 1.1: capture GTFS wheelchair accessibility on Stop, Itinerary
-- and (as a per-schedule override) Schedule.
--
-- Stops carry the boarding flag from stops.wheelchair_boarding.
-- Itineraries hold the majority value across the trips that materialised
-- them — it's what kiosks display when no per-arrival override applies.
-- Schedules only store an override (nullable boolean) when an individual
-- trip diverges from its itinerary's default; null = inherit. This keeps
-- the schedules table compact (by far the largest in the model).

ALTER TABLE stops       ADD COLUMN wheelchair_boarding VARCHAR(20);
ALTER TABLE itineraries ADD COLUMN wheelchair_default  VARCHAR(20);
ALTER TABLE schedules   ADD COLUMN wheelchair_override BOOLEAN;
