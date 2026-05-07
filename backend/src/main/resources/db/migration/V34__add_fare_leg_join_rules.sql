-- Fares v2 closing piece: fare_leg_join_rules.txt.
--
-- A leg-join rule says "two consecutive legs that match on
-- (from_network → to_network, from_stop → to_stop) collapse into a
-- single fare leg" — useful for free transfers between operators
-- of the same network. Niche, very few feeds use it, but persisting
-- closes the v2 spec fully (only fare_media joins were already
-- covered).
--
-- network_id columns stay raw strings (consistent with V30 / V31
-- where leg rules and transfer rules also store network references
-- as raw text). stop_id columns are FK so a removed stop properly
-- nulls the linked rules instead of leaving dangling rows.
--
-- ON DELETE behaviour:
--   - from_stop_id / to_stop_id SET NULL: rule survives a stop
--     deletion with its reference cleared, matching the SET NULL
--     pattern of the other Fares v2 rule tables.

CREATE TABLE fare_leg_join_rules (
    id UUID PRIMARY KEY,
    from_network_id VARCHAR(100),
    to_network_id VARCHAR(100),
    from_stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
    to_stop_id UUID REFERENCES stops(id) ON DELETE SET NULL
);

CREATE INDEX idx_fare_leg_join_rules_from_stop ON fare_leg_join_rules(from_stop_id);
CREATE INDEX idx_fare_leg_join_rules_to_stop ON fare_leg_join_rules(to_stop_id);
CREATE INDEX idx_fare_leg_join_rules_from_network ON fare_leg_join_rules(from_network_id);
CREATE INDEX idx_fare_leg_join_rules_to_network ON fare_leg_join_rules(to_network_id);
