-- Phase 2.2: transfers.txt as a first-class entity. Lets the route-finder
-- weigh each interchange by its declared minimum-time instead of applying
-- a uniform magic cost.

CREATE TABLE transfers (
    id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    from_stop_id      UUID         NOT NULL REFERENCES stops(id),
    to_stop_id        UUID         NOT NULL REFERENCES stops(id),
    transfer_type     SMALLINT     NOT NULL,
    min_transfer_time INTEGER
);

CREATE INDEX idx_transfer_from ON transfers(from_stop_id);
CREATE INDEX idx_transfer_to   ON transfers(to_stop_id);
