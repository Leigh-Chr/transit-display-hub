-- Phase 2.1: persist GTFS shapes.txt as the geographic polyline that
-- traces the path a vehicle follows along its route. Linked from
-- itineraries via shape_id (nullable: many feeds omit shapes, and
-- when present trips reference them through shape_id which we copy
-- onto the representative trip's itinerary).
--
-- The shape_points table can grow large on dense networks (a single
-- urban bus route easily ships 500+ points). The (shape_id, sequence)
-- unique constraint matches the GTFS row identity so a mis-ordered
-- import surfaces immediately rather than silently producing a
-- twisted polyline.

CREATE TABLE shapes (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE shape_points (
    id UUID PRIMARY KEY,
    shape_id UUID NOT NULL REFERENCES shapes(id) ON DELETE CASCADE,
    sequence INT NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    dist_traveled DOUBLE PRECISION,
    CONSTRAINT uk_shape_point_sequence UNIQUE (shape_id, sequence)
);

CREATE INDEX idx_shape_point_shape ON shape_points(shape_id);

ALTER TABLE itineraries ADD COLUMN shape_id UUID
    REFERENCES shapes(id) ON DELETE SET NULL;
