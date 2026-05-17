-- Force the initial admin (admin / admin123 seeded in V2) to rotate the
-- password at first login. Future users get FALSE by default. Existing
-- non-admin users keep FALSE so we don't nag everyone retroactively.
ALTER TABLE users
    ADD COLUMN password_must_change BOOLEAN NOT NULL DEFAULT FALSE;

UPDATE users
SET password_must_change = TRUE
WHERE username = 'admin';
