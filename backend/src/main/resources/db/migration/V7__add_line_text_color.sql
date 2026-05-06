-- Phase 0.2: store the foreground color used to render text on top of
-- `lines.color`. GTFS feeds expose `route_text_color`; when missing we
-- compute a contrast-safe value from `route_color` at import time using
-- the YIQ luminance formula. Persisting it avoids re-deriving the value
-- on every render and lets operators override the choice manually.

ALTER TABLE lines ADD COLUMN text_color VARCHAR(7);
