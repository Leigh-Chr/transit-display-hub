-- Phase 0.3: model GTFS agency.txt as a first-class entity.
--
-- The Lines table gains a nullable foreign key to agencies. Existing rows
-- (created before this migration) keep agency_id NULL and resolve their
-- timezone via the application-level default; new imports route every
-- line through its declared agency.

CREATE TABLE agencies (
    id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    version     BIGINT       NOT NULL DEFAULT 0,
    external_id VARCHAR(100),
    name        VARCHAR(200) NOT NULL,
    url         VARCHAR(500),
    timezone    VARCHAR(60),
    lang        VARCHAR(10),
    phone       VARCHAR(30),
    fare_url    VARCHAR(500),
    email       VARCHAR(100)
);

CREATE INDEX idx_agency_external_id ON agencies(external_id);

ALTER TABLE lines ADD COLUMN agency_id UUID REFERENCES agencies(id);

CREATE INDEX idx_lines_agency ON lines(agency_id);
