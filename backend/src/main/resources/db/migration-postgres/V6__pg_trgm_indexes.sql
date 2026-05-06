-- Postgres-only: trigram GIN indexes on `LOWER(name)` for the search columns
-- the admin tables filter against. Without these, a typical
--   WHERE LOWER(name) LIKE LOWER('%term%')
-- forces a sequential scan because B-tree indexes can't help the leading
-- wildcard. With pg_trgm the same query becomes index-supported and stays
-- responsive into the tens-of-thousands-of-rows range that GTFS imports
-- routinely produce.
--
-- This migration lives under db/migration-postgres/ and is only loaded by
-- the prod profile (see application.yml: spring.flyway.locations) so the
-- H2 dev/test profile keeps booting without trying to install the extension.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_lines_name_trgm
        ON lines USING gin (LOWER(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_lines_code_trgm
        ON lines USING gin (LOWER(code) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_stops_name_trgm
        ON stops USING gin (LOWER(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_itineraries_name_trgm
        ON itineraries USING gin (LOWER(name) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
        ON users USING gin (LOWER(username) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_messages_title_trgm
        ON broadcast_messages USING gin (LOWER(title) gin_trgm_ops);
