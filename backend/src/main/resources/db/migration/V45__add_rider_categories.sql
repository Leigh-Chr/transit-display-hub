-- GTFS Fares v2 rider_categories.txt: each row describes a passenger
-- segment (adult, child, senior, …) that fare_products.rider_category_id
-- can target. The is_default_fare_category flag picks the row to fall
-- back on when no other category matches — there must be exactly one
-- per fare_media but we don't enforce that constraint at the DB level
-- (validators job, not Flyway's).

CREATE TABLE rider_categories (
    id UUID PRIMARY KEY,
    external_id VARCHAR(100) NOT NULL,
    name VARCHAR(200),
    is_default_fare_category SMALLINT,
    eligibility_url VARCHAR(500),
    CONSTRAINT uk_rider_category_external_id UNIQUE (external_id)
);

ALTER TABLE fare_products
    ADD COLUMN rider_category_id VARCHAR(100);

CREATE INDEX idx_fare_product_rider_category ON fare_products(rider_category_id);
