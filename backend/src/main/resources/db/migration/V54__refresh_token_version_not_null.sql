-- V50 shipped refresh_tokens.version as BIGINT (nullable, no default) even
-- though the entity carries @Version Long. Hibernate handles the NULL on
-- first write, but the column drifted from the V4 convention and would
-- bite anyone seeding a row via raw SQL. Backfill the few NULLs an
-- existing deployment may carry, then align the column with every other
-- @Version surface.

UPDATE refresh_tokens SET version = 0 WHERE version IS NULL;

ALTER TABLE refresh_tokens ALTER COLUMN version SET DEFAULT 0;
ALTER TABLE refresh_tokens ALTER COLUMN version SET NOT NULL;
