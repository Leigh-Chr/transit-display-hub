-- Postgres-only pg_trgm GIN index on broadcast_messages.content.
--
-- MessageSpecifications.textMatches issues LIKE '%term%' against both
-- title AND content; V6 only indexed title, so a content search forced
-- a sequential scan over the whole table once the message archive grew
-- past a few hundred rows. Audit 2026-05-12 P2 (06-perf-observability).
--
-- LOWER(...) so the index matches the application-side
-- case-insensitive comparison (`LOWER(content) LIKE LOWER('%term%')`).

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm
        ON broadcast_messages USING gin (LOWER(content) gin_trgm_ops);
