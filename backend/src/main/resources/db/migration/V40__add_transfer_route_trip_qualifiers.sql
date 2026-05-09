-- transfers.txt can scope a transfer rule to a specific route or trip
-- pair, not just stops. Without these qualifiers a feed that ships
-- "from M1 to B1 at QUAY_CENTRAL: 60 s" lands as the generic
-- stop-to-stop rule and the route-finder misapplies it across every
-- line at that interchange. Stored as opaque external_ids so the
-- route-finder can join through Line.external_id / Itinerary.external_id
-- without paying for a relational FK that few rows will populate.

ALTER TABLE transfers
    ADD COLUMN from_route_id VARCHAR(100),
    ADD COLUMN to_route_id VARCHAR(100),
    ADD COLUMN from_trip_id VARCHAR(100),
    ADD COLUMN to_trip_id VARCHAR(100);

CREATE INDEX idx_transfer_from_route ON transfers(from_route_id);
CREATE INDEX idx_transfer_to_route ON transfers(to_route_id);
