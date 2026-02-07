-- Default admin user for first login (password: admin123)
-- Change this password immediately after deployment.
INSERT INTO users (id, username, password, role, enabled)
VALUES (
    gen_random_uuid(),
    'admin',
    '$2b$10$28Te1rUTxBMomfpHWlV1ouAyJu0jI97.Yux6wb0p7N6asFDtq4C0q',
    'ADMIN',
    TRUE
);
