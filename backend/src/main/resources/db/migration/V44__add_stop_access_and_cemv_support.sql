-- Spec extensions for accessibility / payment support that landed in
-- the GTFS reference between 2023 and 2025.
--
--   stops.stop_access      0 = generally accessible, 1 = restricted
--                          (employees only). Conditionally forbidden
--                          for stations / entrances / nodes / boarding
--                          areas; we just persist whatever the feed
--                          ships and let the caller decide.
--
--   agency.cemv_support    contactless EMV (card-tap) acceptance at
--                          this agency: 0 not supported, 1 supported,
--                          2 ask the operator. Surchargé par
--                          routes.cemv_support quand la valeur diffère
--                          d'une ligne à l'autre.
--
--   routes.cemv_support    same enum at the line level; takes
--                          precedence over the agency value.

ALTER TABLE stops      ADD COLUMN stop_access SMALLINT;
ALTER TABLE agencies   ADD COLUMN cemv_support SMALLINT;
ALTER TABLE lines      ADD COLUMN cemv_support SMALLINT;
