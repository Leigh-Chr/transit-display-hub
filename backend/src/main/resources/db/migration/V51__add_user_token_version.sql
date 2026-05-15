-- Per-user JWT generation counter. Every access token embeds its current
-- value at mint time; the auth filter rejects any token whose embedded
-- counter is older than the user's row, giving us immediate revocation
-- (disable, role change, password reset, refresh-chain revoke) without
-- waiting for the JWT to expire.

ALTER TABLE users
    ADD COLUMN token_version BIGINT NOT NULL DEFAULT 0;
