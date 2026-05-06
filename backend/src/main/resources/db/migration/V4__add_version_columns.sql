-- Optimistic-locking columns for entities edited concurrently by multiple admins.
-- Hibernate populates `version` automatically; existing rows get 0 to satisfy
-- the @Version contract on first read.

ALTER TABLE users               ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE lines               ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE stops               ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE itineraries         ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE schedules           ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE broadcast_messages  ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
