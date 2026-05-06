-- Phase 1.2: capture trips.bikes_allowed at the itinerary level (majority
-- of contributing trips) and as a per-schedule override when an individual
-- trip diverges. Same compact storage strategy as wheelchair access in V15.

ALTER TABLE itineraries ADD COLUMN bikes_allowed_default VARCHAR(20);
ALTER TABLE schedules   ADD COLUMN bikes_allowed_override BOOLEAN;
