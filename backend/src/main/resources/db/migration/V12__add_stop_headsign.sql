-- Phase 1.5: capture stop_times.stop_headsign — the destination text the
-- vehicle's roller display shows at *this* stop, which can differ from
-- the trip's overall headsign on lines that change their public destination
-- mid-route. Without this, kiosks always show the line's terminus and
-- mislead passengers when the next service is short-running.

ALTER TABLE itinerary_stops ADD COLUMN stop_headsign VARCHAR(100);
