-- Phase 0.8: append-only log of GTFS import attempts.
--
-- Distinct from feed_info (the singleton describing the loaded feed):
-- import_audit captures every attempt — successful, skipped or failed —
-- so the admin can answer "when did the last refresh run, did it succeed,
-- and how big was the resulting dataset?".

CREATE TABLE import_audit (
    id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    source_url         VARCHAR(500),
    source_hash        VARCHAR(64),
    started_at         TIMESTAMPTZ  NOT NULL,
    completed_at       TIMESTAMPTZ,
    duration_ms        BIGINT,
    lines_count        INTEGER,
    stops_count        INTEGER,
    itineraries_count  INTEGER,
    schedules_count    INTEGER,
    status             VARCHAR(20)  NOT NULL,
    error_message      VARCHAR(1000),
    triggered_by       VARCHAR(50)
);

CREATE INDEX idx_import_audit_started_at ON import_audit(started_at);
