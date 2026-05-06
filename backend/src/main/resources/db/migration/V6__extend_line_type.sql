-- Phase 0.1: extend the `lines.type` column to fit the longer transit modes
-- introduced alongside the GTFS HVT mapping (TROLLEYBUS, FUNICULAR, CABLE_CAR,
-- MONORAIL, FERRY, OTHER). The original VARCHAR(10) was sized for the four
-- starter modes only.

ALTER TABLE lines ALTER COLUMN type TYPE VARCHAR(15);
