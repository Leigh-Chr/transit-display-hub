-- Drop the GTFS shapes pipeline. The schematic map is topological by
-- design (ADR 0014 superseded) — shapes never reached a passenger
-- surface, and the dedicated admin viewer was the only consumer of
-- the persisted rows. Removing the tables avoids carrying millions
-- of shape_points (urban feeds quickly exceed 500 points per shape)
-- for data nothing reads.

ALTER TABLE itineraries DROP COLUMN shape_id;
DROP TABLE shape_points;
DROP TABLE shapes;
