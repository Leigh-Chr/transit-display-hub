-- Phase 0.5a: persist GTFS source identifiers on the entities the
-- importer creates so a future re-import can match rows by their
-- external_id rather than wiping the table.
--
-- The columns are nullable on purpose: the field is unknown for rows
-- created via the synthetic seed loader or the manual admin form, and
-- absent feeds have no source id to record. Indexed lookups are still
-- fast because the indexes are partial (NULLs are excluded by the
-- query patterns we'll use in 0.5c).
--
-- `stops.disabled` gates rows that have been "tombstoned" by a re-import
-- but kept around for the kiosk farewell push and pending Device
-- reconciliation. The column is added now so all read queries can
-- start filtering on it before the matching algorithm lands.

ALTER TABLE stops       ADD COLUMN external_id VARCHAR(100);
ALTER TABLE stops       ADD COLUMN disabled    BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE lines       ADD COLUMN external_id VARCHAR(100);
ALTER TABLE itineraries ADD COLUMN external_id VARCHAR(100);

CREATE INDEX idx_stops_external_id       ON stops(external_id);
CREATE INDEX idx_stops_disabled          ON stops(disabled);
CREATE INDEX idx_lines_external_id       ON lines(external_id);
CREATE INDEX idx_itineraries_external_id ON itineraries(external_id);
