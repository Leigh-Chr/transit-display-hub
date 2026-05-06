-- Phase 1.4: persist GTFS calendar.txt and calendar_dates.txt so that
-- each schedule row can declare which days of the week it actually
-- runs. Until now the importer collapsed every feed onto a single
-- representative day, which meant kiosks showed the same arrivals on
-- a Sunday as they did on a Tuesday.
--
-- service_calendar_id is nullable on schedules: existing installs and
-- admin-created schedules predating GTFS multi-day support keep the
-- old "always active" behaviour. The display calculator treats a null
-- FK as "show every day", so this migration is fully additive.

CREATE TABLE service_calendars (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE,
    start_date DATE,
    end_date DATE,
    monday BOOLEAN NOT NULL DEFAULT FALSE,
    tuesday BOOLEAN NOT NULL DEFAULT FALSE,
    wednesday BOOLEAN NOT NULL DEFAULT FALSE,
    thursday BOOLEAN NOT NULL DEFAULT FALSE,
    friday BOOLEAN NOT NULL DEFAULT FALSE,
    saturday BOOLEAN NOT NULL DEFAULT FALSE,
    sunday BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE service_calendar_exceptions (
    id UUID PRIMARY KEY,
    service_calendar_id UUID NOT NULL REFERENCES service_calendars(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    exception_type VARCHAR(16) NOT NULL,
    CONSTRAINT uk_service_calendar_exception UNIQUE (service_calendar_id, date)
);

CREATE INDEX idx_service_calendar_exception_calendar
    ON service_calendar_exceptions(service_calendar_id);
CREATE INDEX idx_service_calendar_exception_date
    ON service_calendar_exceptions(date);

ALTER TABLE schedules ADD COLUMN service_calendar_id UUID
    REFERENCES service_calendars(id) ON DELETE SET NULL;

CREATE INDEX idx_schedules_service_calendar ON schedules(service_calendar_id);

-- The previous unique constraint (stop_id, itinerary_id, time) was fine
-- when the importer only kept a single representative-day's schedules.
-- Now that we persist every active service, two services that share a
-- {stop, itinerary, time} triple (e.g. weekday and saturday running the
-- same evening departure) need to coexist. Standard SQL semantics treat
-- NULL ≠ NULL inside a unique constraint, so admin-created schedules
-- with no service_calendar_id remain unique on the original triple.

ALTER TABLE schedules DROP CONSTRAINT uk_schedule_stop_itinerary_time;

ALTER TABLE schedules ADD CONSTRAINT uk_schedule_stop_itinerary_time_calendar
    UNIQUE (stop_id, itinerary_id, time, service_calendar_id);
