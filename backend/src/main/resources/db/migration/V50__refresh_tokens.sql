-- Refresh tokens for the cookie-based auth flow introduced in v1.4.0.
--
-- We never store the raw refresh token: only the SHA-256 hex digest of
-- the random 256-bit value handed to the client. This keeps the table
-- useless to an attacker who manages to read it, while still allowing
-- O(1) lookup by hash from the cookie at refresh time.
--
-- replaced_by_id walks the rotation chain — every successful /refresh
-- mints a new row and links the previous one to it, so reuse of an
-- already-rotated token can be detected and the whole chain revoked.

CREATE TABLE refresh_tokens (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version         BIGINT,
    user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash      VARCHAR(64) NOT NULL UNIQUE,
    issued_at       TIMESTAMP NOT NULL,
    expires_at      TIMESTAMP NOT NULL,
    revoked_at      TIMESTAMP,
    replaced_by_id  UUID REFERENCES refresh_tokens(id) ON DELETE SET NULL,
    user_agent      VARCHAR(255),
    ip_address      VARCHAR(45)
);

CREATE INDEX idx_refresh_token_user ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_token_expires_at ON refresh_tokens(expires_at);
