-- The MobilityData gtfs-validator runs after each successful import
-- (see GtfsImportOrchestrator + GtfsValidatorService). The three
-- columns below let the admin timeline surface the outcome:
--
--   validation_report_dir : on-disk directory holding report.json /
--                           report.html / system_errors.json. Null
--                           when validation is disabled or never ran.
--   validation_status     : SUCCESS / FAILED / SKIPPED — orthogonal to
--                           the import status. SUCCESS = the runner
--                           completed (the feed itself may still hold
--                           ERROR-level notices).
--   validation_notice_*   : pre-counted ERROR and WARNING totals so
--                           the admin row can render a "23 errors"
--                           badge without parsing report.json.

ALTER TABLE import_audit
    ADD COLUMN validation_report_dir VARCHAR(500),
    ADD COLUMN validation_status VARCHAR(20),
    ADD COLUMN validation_notice_errors INTEGER,
    ADD COLUMN validation_notice_warnings INTEGER;
