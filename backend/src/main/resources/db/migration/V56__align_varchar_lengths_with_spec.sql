-- GTFS conformance audit (2026-05-18) flagged a few VARCHAR widths
-- that were tighter than the data the spec realistically allows:
--
-- - agencies.lang capped at 10, which rejects the longer BCP-47
--   extended tags such as `zh-Hans-CN` (10 chars, zero margin) and
--   diverged from feed_info.lang / translations.language (20).
-- - feed_info.contact_email capped at 50, well short of RFC 5321's
--   254 max and tight on real "feedmaster+integration-prod@…" forms.
-- - stops.url / lines.url capped at 255 while agencies.url and
--   feed_info.*_url all sit at 500 — same kind of GTFS URL field,
--   inconsistent width was a leftover from the early schema.
--
-- All four changes only widen the column, so existing rows survive
-- the migration unchanged. No data backfill needed.

ALTER TABLE agencies            ALTER COLUMN lang          TYPE VARCHAR(20);
ALTER TABLE feed_info           ALTER COLUMN contact_email TYPE VARCHAR(200);
ALTER TABLE stops               ALTER COLUMN url           TYPE VARCHAR(500);
ALTER TABLE lines               ALTER COLUMN url           TYPE VARCHAR(500);
