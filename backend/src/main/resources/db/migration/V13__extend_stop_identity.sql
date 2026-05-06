-- Phase 1.7: enrich Stop with the GTFS optional identity fields the
-- kiosk and admin can surface — short code (the "BSP1234" tag printed
-- on the physical signpost), TTS name (for accessibility readers),
-- stop-level timezone (for transit networks crossing zones), description
-- and a public URL.

ALTER TABLE stops ADD COLUMN short_code     VARCHAR(50);
ALTER TABLE stops ADD COLUMN tts_name       VARCHAR(150);
ALTER TABLE stops ADD COLUMN stop_timezone  VARCHAR(60);
ALTER TABLE stops ADD COLUMN description    VARCHAR(500);
ALTER TABLE stops ADD COLUMN url            VARCHAR(255);
