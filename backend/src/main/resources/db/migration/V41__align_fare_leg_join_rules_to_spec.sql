-- The Fares v2 spec on gtfs.org reshaped fare_leg_join_rules.txt
-- between the V34 release of this project and 2026: the canonical
-- columns are now (leg_group_id, leg_sequence,
-- preceding_trip_transfer_limit) — the V34 columns
-- (from_network_id / to_network_id / from_stop_id / to_stop_id) are
-- the legacy MobilityData layout still produced by some feeds.
--
-- We keep the legacy columns nullable for feeds that haven't migrated,
-- and add the canonical trio. The importer prefers the canonical
-- columns when present and falls back to the legacy ones otherwise.

ALTER TABLE fare_leg_join_rules
    ADD COLUMN leg_group_id VARCHAR(100),
    ADD COLUMN leg_sequence INTEGER,
    ADD COLUMN preceding_trip_transfer_limit INTEGER;

CREATE INDEX idx_fare_leg_join_rules_leg_group ON fare_leg_join_rules(leg_group_id);
