-- fare_transfer_rules picked up two boarding-time fields after the
-- initial Fares v2 release. They constrain when the transfer's
-- discount applies relative to the previous leg's boarding time:
--
--   minutes_before_to_start_boarding_time : transfer is valid only if
--   the next leg starts AT LEAST X minutes BEFORE the previous leg's
--   boarding time (used by some pre-boarding fare products)
--
--   minutes_after_to_start_boarding_time  : symmetric — transfer is
--   valid only if the next leg starts WITHIN X minutes AFTER the
--   previous leg's boarding time

ALTER TABLE fare_transfer_rules
    ADD COLUMN minutes_before_to_start_boarding_time INTEGER,
    ADD COLUMN minutes_after_to_start_boarding_time INTEGER;
