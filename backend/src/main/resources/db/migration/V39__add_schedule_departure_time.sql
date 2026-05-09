-- Until now `schedules.time` doubled as both arrival and departure
-- because the importer collapsed the two with firstNonBlank. On
-- terminus stops and long-dwell intermediate stops the spec lets the
-- two diverge by minutes, and the kiosk display calculator can use
-- that gap for "boarding window" cues. Persist them separately, with
-- departure_time nullable: a feed that ships only one column will
-- keep landing on `time` (kept as the arrival) and leave departure_time
-- empty.

ALTER TABLE schedules
    ADD COLUMN departure_time TIME;
