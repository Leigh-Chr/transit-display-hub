-- The translations UK declared in V26 keyed off (table_name, record_id,
-- record_sub_id, field_name, language) — missing field_value, which is
-- the alternative match key the GTFS spec defines for "translate every
-- row whose field equals this value". The pre-fix UK let two rows with
-- the same (table, field, language, field_value) and a null record_id
-- coexist, which silently duplicated the translation surface.
--
-- Drop the old constraint and recreate it with field_value included.

ALTER TABLE translations DROP CONSTRAINT IF EXISTS uk_translation_target;

ALTER TABLE translations
    ADD CONSTRAINT uk_translation_target
    UNIQUE (table_name, record_id, record_sub_id, field_value, field_name, language);
