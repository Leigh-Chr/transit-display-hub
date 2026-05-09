-- GTFS-flex locations.geojson — flexible-trip pickup/dropoff zones.
-- Each Feature is a polygon (or multipolygon) referenced by a TAD
-- stop_id in stop_times. Persisting the raw GeoJSON as TEXT plus
-- pre-computed bounds keeps the admin browser fast without bringing
-- in a spatial library (JTS) for a feature that today only reads
-- back the geometry.
--
-- See ADR 0026.

CREATE TABLE locations (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL,
    stop_external_id VARCHAR(100),
    name VARCHAR(200),
    geometry_type VARCHAR(30) NOT NULL,
    geometry_json TEXT NOT NULL,
    min_latitude DOUBLE PRECISION,
    min_longitude DOUBLE PRECISION,
    max_latitude DOUBLE PRECISION,
    max_longitude DOUBLE PRECISION,
    CONSTRAINT uk_location_external_id UNIQUE (external_id)
);

CREATE INDEX idx_location_stop_external_id ON locations(stop_external_id);
