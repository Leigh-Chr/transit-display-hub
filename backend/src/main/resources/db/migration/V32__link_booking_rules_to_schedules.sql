-- Phase 5.3 follow-up: link schedules to booking rules. The
-- importer persists booking_rules.txt (V29) but never reads
-- stop_times.pickup_booking_rule_id / drop_off_booking_rule_id, so
-- the TAD information stays orphaned from individual arrivals. This
-- migration adds the two FK columns; the next import populates them.
--
-- ON DELETE SET NULL on both: a booking rule getting deleted (rare
-- but possible during a re-import that drops a TAD service) doesn't
-- cascade-delete the schedule rows. The schedule survives with the
-- TAD reference cleared, which is the right outcome for an arrival
-- that lost its booking flow.

ALTER TABLE schedules
    ADD COLUMN pickup_booking_rule_id UUID
        REFERENCES booking_rules(id) ON DELETE SET NULL,
    ADD COLUMN drop_off_booking_rule_id UUID
        REFERENCES booking_rules(id) ON DELETE SET NULL;

CREATE INDEX idx_schedules_pickup_booking ON schedules(pickup_booking_rule_id);
CREATE INDEX idx_schedules_drop_off_booking ON schedules(drop_off_booking_rule_id);
