-- Phase 4.2: persist GTFS translations.txt so kiosks can render stop
-- and line names in the passenger's preferred language. Modelled
-- exactly the way the spec encodes it: one polymorphic table keyed
-- by (table_name, record_id, field_name, language).
--
-- record_id is nullable to support the spec's alternative matching
-- mode (translate every row where field_name == field_value); we
-- persist field_value but the runtime lookup currently only reads
-- the record_id form.

CREATE TABLE translations (
    id UUID PRIMARY KEY,
    table_name VARCHAR(60) NOT NULL,
    record_id VARCHAR(100),
    field_value VARCHAR(200),
    field_name VARCHAR(60) NOT NULL,
    language VARCHAR(20) NOT NULL,
    translation TEXT NOT NULL,
    CONSTRAINT uk_translation_target UNIQUE (table_name, record_id, field_name, language)
);

CREATE INDEX idx_translation_lang_table ON translations(language, table_name);
CREATE INDEX idx_translation_record ON translations(table_name, record_id, language);
