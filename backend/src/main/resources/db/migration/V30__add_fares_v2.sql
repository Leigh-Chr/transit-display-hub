-- Fares v2: areas, timeframes, fare_products, fare_leg_rules,
-- fare_transfer_rules. Coexists with Fares v1 (V27) — feeds publish
-- one or the other, sometimes both during a transition. Both layers
-- persist independently; the kiosk picks v2 when present, falls back
-- to v1.
--
-- Scope intentionally trimmed:
--   - networks.txt + route_networks.txt: skipped. Networks are an
--     organisational layer; leg rules just store the raw network_id
--     string so the data isn't lost when networks.txt isn't imported.
--   - fare_media.txt: skipped. Media (cards, mobile, paper ticket)
--     is mostly UX-only; products carry the raw fare_media_id string
--     pending a media browser surface.
--   - fare_leg_join_rules.txt: skipped. Niche, used by very few feeds.
--
-- ON DELETE behaviour:
--   - stop_areas.stop_id CASCADE: removing a stop unbinds it from
--     every area it belonged to, no dangling rows.
--   - stop_areas.area_id CASCADE: same when removing the area.
--   - fare_leg_rules.* SET NULL: leg rules survive their referenced
--     area / timeframe / product going away — the rule still exists
--     in the audit trail with the missing reference visible as null.
--   - fare_transfer_rules.from/to_leg_group_id: stored as plain
--     varchar (group ids, not surrogate FKs) since multiple leg rules
--     can share the same leg_group_id. Loose link, hand-resolved.

CREATE TABLE areas (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200)
);

CREATE TABLE stop_areas (
    area_id UUID NOT NULL REFERENCES areas(id) ON DELETE CASCADE,
    stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    PRIMARY KEY (area_id, stop_id)
);

CREATE INDEX idx_stop_areas_stop ON stop_areas(stop_id);

CREATE TABLE timeframes (
    id UUID PRIMARY KEY,
    -- timeframe_group_id is the natural key but multiple rows can share
    -- it (one per service+window). external_id stays the surrogate.
    timeframe_group_id VARCHAR(100) NOT NULL,
    start_time TIME,
    end_time TIME,
    service_id VARCHAR(100)
);

CREATE INDEX idx_timeframes_group ON timeframes(timeframe_group_id);

CREATE TABLE fare_products (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200),
    -- fare_media_id stays raw: we don't import fare_media.txt.
    fare_media_id VARCHAR(100),
    amount NUMERIC(12, 4) NOT NULL,
    currency VARCHAR(3) NOT NULL
);

CREATE TABLE fare_leg_rules (
    id UUID PRIMARY KEY,
    -- leg_group_id is shared across rule rows; not a surrogate.
    leg_group_id VARCHAR(100),
    -- network_id raw: networks.txt not imported (yet).
    network_id VARCHAR(100),
    from_area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    to_area_id UUID REFERENCES areas(id) ON DELETE SET NULL,
    from_timeframe_group_id VARCHAR(100),
    to_timeframe_group_id VARCHAR(100),
    fare_product_id UUID REFERENCES fare_products(id) ON DELETE SET NULL,
    rule_priority INT
);

CREATE INDEX idx_fare_leg_rules_product ON fare_leg_rules(fare_product_id);
CREATE INDEX idx_fare_leg_rules_from_area ON fare_leg_rules(from_area_id);
CREATE INDEX idx_fare_leg_rules_to_area ON fare_leg_rules(to_area_id);
CREATE INDEX idx_fare_leg_rules_leg_group ON fare_leg_rules(leg_group_id);

CREATE TABLE fare_transfer_rules (
    id UUID PRIMARY KEY,
    from_leg_group_id VARCHAR(100),
    to_leg_group_id VARCHAR(100),
    transfer_count INT,
    duration_limit INT,
    duration_limit_type SMALLINT,
    fare_transfer_type SMALLINT NOT NULL,
    fare_product_id UUID REFERENCES fare_products(id) ON DELETE SET NULL
);

CREATE INDEX idx_fare_transfer_rules_product ON fare_transfer_rules(fare_product_id);
CREATE INDEX idx_fare_transfer_rules_from ON fare_transfer_rules(from_leg_group_id);
CREATE INDEX idx_fare_transfer_rules_to ON fare_transfer_rules(to_leg_group_id);
