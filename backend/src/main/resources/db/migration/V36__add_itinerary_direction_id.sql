-- GTFS trips.direction_id was already extracted in-memory during the
-- itinerary build (RouteDirKey groups trips by route + direction) but
-- never persisted, so callers had no way to ask "which direction does
-- this itinerary represent?". Storing it as a SMALLINT mirrors the
-- spec (0 = outbound, 1 = inbound, NULL = feed didn't declare).

ALTER TABLE itineraries
    ADD COLUMN direction_id SMALLINT;

CREATE INDEX idx_itinerary_line_direction
    ON itineraries(line_id, direction_id);
