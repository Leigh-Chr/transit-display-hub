-- Phase 6 polish bundle:
--
-- 6.1 — Widen lines.code from VARCHAR(10) to VARCHAR(30). The 10-char
--       cap silently truncated codes like "TGV INOUI 6512" and forced
--       the importer to suffix collisions ("...-2") that degraded
--       readability on the kiosk badge. The frontend already handles
--       longer codes by font auto-shrinking.
--
-- 6.2 — Persist routes.route_sort_order, route_desc and route_url.
--       Sort order drives the stable line ordering on the network map
--       and admin lists; description and url enrich the stop popup.
--
-- 6.3 — Persist stop_times.timepoint. Boolean default TRUE (meaning
--       "exact"); FALSE flags an approximate time that the kiosk
--       prefixes with a tilde so passengers know not to set their
--       watch by it.

ALTER TABLE lines ALTER COLUMN code TYPE VARCHAR(30);

ALTER TABLE lines ADD COLUMN sort_order   INTEGER;
ALTER TABLE lines ADD COLUMN description  VARCHAR(500);
ALTER TABLE lines ADD COLUMN url          VARCHAR(255);

ALTER TABLE schedules ADD COLUMN timepoint BOOLEAN NOT NULL DEFAULT TRUE;
