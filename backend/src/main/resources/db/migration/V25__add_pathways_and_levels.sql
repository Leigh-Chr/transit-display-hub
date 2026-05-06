-- Phase 5.1: persist GTFS pathways.txt and levels.txt so the admin can
-- inspect a station's indoor topology (which platform connects to
-- which exit, via stairs vs lift, with what traversal time).
--
-- Endpoints reference the persisted stops table; until Phase 1.3
-- introduces per-platform Stop rows, the importer will collapse most
-- endpoints to the root station, which is acceptable: pathway data
-- is still useful as connectivity metadata, and the per-platform
-- refactor will only need to remap the FKs without schema changes.

CREATE TABLE station_levels (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    parent_stop_id UUID REFERENCES stops(id) ON DELETE SET NULL,
    level_index DOUBLE PRECISION NOT NULL,
    level_name VARCHAR(100)
);

CREATE INDEX idx_station_level_parent ON station_levels(parent_stop_id);

CREATE TABLE pathways (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    from_stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    to_stop_id UUID NOT NULL REFERENCES stops(id) ON DELETE CASCADE,
    pathway_mode VARCHAR(20) NOT NULL,
    is_bidirectional BOOLEAN NOT NULL DEFAULT FALSE,
    length_metres DOUBLE PRECISION,
    traversal_time_seconds INT,
    stair_count INT,
    max_slope DOUBLE PRECISION,
    min_width_metres DOUBLE PRECISION,
    signposted_as VARCHAR(200),
    reversed_signposted_as VARCHAR(200)
);

CREATE INDEX idx_pathway_from ON pathways(from_stop_id);
CREATE INDEX idx_pathway_to ON pathways(to_stop_id);
