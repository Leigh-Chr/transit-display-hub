-- GTFS stops.zone_id is the foreign key target of fare_rules
-- (origin_id / destination_id / contains_id). Without it the V1 fare
-- table is unusable: a fare rule says "from zone A to zone B" but no
-- stop is tagged with a zone, so the runtime can't tell which fare
-- applies. Stored as an opaque string to mirror how the spec treats
-- the value (no foreign key — zones are a label, not their own table).

ALTER TABLE stops
    ADD COLUMN zone_id VARCHAR(100);

CREATE INDEX idx_stop_zone_id ON stops(zone_id);
