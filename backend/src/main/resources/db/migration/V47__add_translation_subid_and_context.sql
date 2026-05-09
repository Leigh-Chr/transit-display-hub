-- translations.txt picked up two extra columns after V26:
--
--   record_sub_id   for stop_times-scoped translations, where
--                   record_id alone (a stop_id) is ambiguous and
--                   the trip_id is supplied alongside as
--                   record_sub_id
--
--   language_context disambiguates two translations of the same
--                   record / field / language for different display
--                   contexts (e.g. "long" vs "short" form)
--
-- Both nullable. The existing unique constraint on
-- (table_name, record_id, field_name, language) is widened to include
-- record_sub_id so a stop translated under different trip contexts
-- doesn't collide.

ALTER TABLE translations
    ADD COLUMN record_sub_id VARCHAR(100),
    ADD COLUMN language_context VARCHAR(100);

ALTER TABLE translations
    DROP CONSTRAINT uk_translation_target;

ALTER TABLE translations
    ADD CONSTRAINT uk_translation_target
        UNIQUE (table_name, record_id, record_sub_id, field_name, language);
