-- Phase 4.3: attributions.txt as a first-class entity. Replaces the
-- single env-var attribution we used to surface on the network map
-- footer with the canonical multi-organisation credit block published
-- by the feed (data producer, operator, authority).

CREATE TABLE attributions (
    id                  UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
    external_id         VARCHAR(100),
    organization_name   VARCHAR(200) NOT NULL,
    is_producer         BOOLEAN      NOT NULL DEFAULT FALSE,
    is_operator         BOOLEAN      NOT NULL DEFAULT FALSE,
    is_authority        BOOLEAN      NOT NULL DEFAULT FALSE,
    agency_external_id  VARCHAR(100),
    route_external_id   VARCHAR(100),
    trip_external_id    VARCHAR(100),
    url                 VARCHAR(500),
    email               VARCHAR(100),
    phone               VARCHAR(30)
);
