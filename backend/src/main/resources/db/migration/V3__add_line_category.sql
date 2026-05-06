-- Add the 'category' column on the `lines` table to match the JPA entity.
-- Without this column, `ddl-auto: validate` (production profile) blocks the
-- application boot, and any code path writing `line.category` (e.g. GTFS import)
-- fails at flush time.

ALTER TABLE lines ADD COLUMN category VARCHAR(50);
