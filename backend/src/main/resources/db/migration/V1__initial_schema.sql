-- Transit Display Hub - Initial Schema
-- PostgreSQL 13+

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE users (
    id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50)  NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role     VARCHAR(20)  NOT NULL,
    enabled  BOOLEAN      NOT NULL DEFAULT TRUE
);

-- ============================================================
-- LINES
-- ============================================================
CREATE TABLE lines (
    id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code  VARCHAR(10)  NOT NULL UNIQUE,
    name  VARCHAR(100) NOT NULL,
    color VARCHAR(7)   NOT NULL,
    type  VARCHAR(10)
);

-- ============================================================
-- STOPS
-- ============================================================
CREATE TABLE stops (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name         VARCHAR(100)     NOT NULL,
    latitude     DOUBLE PRECISION,
    longitude    DOUBLE PRECISION,
    schematicx   DOUBLE PRECISION,
    schematicy   DOUBLE PRECISION
);

-- ============================================================
-- STOP_LINES  (ManyToMany join table)
-- ============================================================
CREATE TABLE stop_lines (
    stop_id UUID NOT NULL REFERENCES stops(id),
    line_id UUID NOT NULL REFERENCES lines(id),
    PRIMARY KEY (stop_id, line_id)
);

-- ============================================================
-- ITINERARIES
-- ============================================================
CREATE TABLE itineraries (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_id UUID         NOT NULL REFERENCES lines(id),
    name    VARCHAR(100) NOT NULL,
    CONSTRAINT uk_itinerary_line_name UNIQUE (line_id, name)
);

CREATE INDEX idx_itinerary_line ON itineraries(line_id);

-- ============================================================
-- ITINERARY_STOPS
-- ============================================================
CREATE TABLE itinerary_stops (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    itinerary_id UUID    NOT NULL REFERENCES itineraries(id),
    stop_id      UUID    NOT NULL REFERENCES stops(id),
    position     INTEGER NOT NULL CHECK (position >= 0),
    CONSTRAINT uk_itinerary_stop     UNIQUE (itinerary_id, stop_id),
    CONSTRAINT uk_itinerary_position UNIQUE (itinerary_id, position)
);

CREATE INDEX idx_itinerary_stop_itinerary ON itinerary_stops(itinerary_id);
CREATE INDEX idx_itinerary_stop_stop      ON itinerary_stops(stop_id);

-- ============================================================
-- SCHEDULES
-- ============================================================
CREATE TABLE schedules (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    time         TIME NOT NULL,
    stop_id      UUID NOT NULL REFERENCES stops(id),
    itinerary_id UUID NOT NULL REFERENCES itineraries(id),
    CONSTRAINT uk_schedule_stop_itinerary_time UNIQUE (stop_id, itinerary_id, time)
);

CREATE INDEX idx_schedule_stop_time  ON schedules(stop_id, time);
CREATE INDEX idx_schedule_itinerary  ON schedules(itinerary_id);

-- ============================================================
-- DEVICES
-- ============================================================
CREATE TABLE devices (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    token_lookup   VARCHAR(8)   NOT NULL,
    token_hash     VARCHAR(60)  NOT NULL UNIQUE,
    stop_id        UUID         NOT NULL REFERENCES stops(id),
    status         VARCHAR(20)  NOT NULL DEFAULT 'OFFLINE',
    last_heartbeat TIMESTAMPTZ
);

CREATE INDEX idx_device_token_lookup  ON devices(token_lookup);
CREATE INDEX idx_device_status        ON devices(status);
CREATE INDEX idx_device_last_heartbeat ON devices(last_heartbeat);

-- ============================================================
-- BROADCAST_MESSAGES
-- ============================================================
CREATE TABLE broadcast_messages (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title      VARCHAR(100) NOT NULL,
    content    VARCHAR(500) NOT NULL,
    severity   VARCHAR(20)  NOT NULL,
    start_time TIMESTAMPTZ  NOT NULL,
    end_time   TIMESTAMPTZ  NOT NULL,
    scope_type VARCHAR(20)  NOT NULL,
    scope_id   UUID,
    CONSTRAINT chk_message_time_range CHECK (end_time > start_time)
);

CREATE INDEX idx_message_time_range ON broadcast_messages(start_time, end_time);
CREATE INDEX idx_message_scope      ON broadcast_messages(scope_type, scope_id);
