-- Phase 4.1: persist GTFS Fares v1 (fare_attributes.txt + fare_rules.txt).
-- Stored as-is so admins can audit each fare's price, currency, transfer
-- policy and the routes / zones it applies to. Fares v2 (fare_products,
-- fare_leg_rules, areas) intentionally out of scope for this migration;
-- the v1 table can coexist with future v2 tables.
--
-- ON DELETE behaviour:
--   - fare_rules.fare_attribute_id CASCADE: a fare attribute cannot
--     have orphan rules.
--   - fare_rules.route_id SET NULL: dropping a line shouldn't take
--     fare data with it; the rule becomes "applies regardless of route".
--   - fare_attributes.agency_id SET NULL: same logic for agencies.

CREATE TABLE fare_attributes (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    price NUMERIC(12, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL,
    payment_method VARCHAR(20) NOT NULL,
    transfers INT,
    transfer_duration INT,
    agency_id UUID REFERENCES agencies(id) ON DELETE SET NULL
);

CREATE INDEX idx_fare_attributes_agency ON fare_attributes(agency_id);

CREATE TABLE fare_rules (
    id UUID PRIMARY KEY,
    fare_attribute_id UUID NOT NULL REFERENCES fare_attributes(id) ON DELETE CASCADE,
    route_id UUID REFERENCES lines(id) ON DELETE SET NULL,
    origin_id VARCHAR(100),
    destination_id VARCHAR(100),
    contains_id VARCHAR(100)
);

CREATE INDEX idx_fare_rule_attribute ON fare_rules(fare_attribute_id);
CREATE INDEX idx_fare_rule_route ON fare_rules(route_id);
