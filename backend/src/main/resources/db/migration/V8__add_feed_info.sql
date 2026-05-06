-- Phase 0.4: store the provenance of the loaded GTFS feed.
--
-- A singleton row (replaced on every successful re-import) describing
-- who published the feed, its declared validity window, and the audit
-- metadata we use to surface "feed is stale" / "feed is invalid today"
-- warnings in the admin dashboard.

CREATE TABLE feed_info (
    id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    version         BIGINT       NOT NULL DEFAULT 0,
    publisher_name  VARCHAR(200),
    publisher_url   VARCHAR(500),
    lang            VARCHAR(20),
    default_lang    VARCHAR(20),
    feed_version    VARCHAR(50),
    contact_email   VARCHAR(50),
    contact_url     VARCHAR(500),
    start_date      DATE,
    end_date        DATE,
    source_url      VARCHAR(500),
    source_hash     VARCHAR(64),
    imported_at     TIMESTAMPTZ
);
