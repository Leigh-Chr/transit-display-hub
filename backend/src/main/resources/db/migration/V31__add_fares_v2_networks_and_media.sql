-- Fares v2 follow-up: networks (+ route_networks join) and fare_media.
-- Closes the gap left by V30, which kept network_id and fare_media_id
-- as raw strings on fare_leg_rules / fare_products. We keep the raw
-- columns as they are — promoting them to FKs would force a v2
-- import-time dependency cycle (networks must exist before leg rules,
-- which already reference them by string). Loose link, hand-resolved.
--
-- networks vs route_networks: networks.txt declares the network names;
-- route_networks.txt links each network to a list of route_id values
-- (one network → many routes). The join table is M2M to match the
-- spec; a route can in principle be in multiple networks (rare but
-- legal).
--
-- fare_media: payment media (cash, card, mobile, transit pass) referenced
-- by fare_products.fare_media_id. Most feeds ship one row per supported
-- medium; the column exists primarily so we can render "carte sans
-- contact" / "mobile" / "ticket papier" labels next to a product.

CREATE TABLE networks (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200)
);

CREATE TABLE route_networks (
    network_id UUID NOT NULL REFERENCES networks(id) ON DELETE CASCADE,
    route_id UUID NOT NULL REFERENCES lines(id) ON DELETE CASCADE,
    PRIMARY KEY (network_id, route_id)
);

CREATE INDEX idx_route_networks_route ON route_networks(route_id);

CREATE TABLE fare_media (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(200),
    -- GTFS fare_media_type: 0=none, 1=paper, 2=transit_card,
    -- 3=contactless_emv, 4=mobile_app
    media_type SMALLINT
);
