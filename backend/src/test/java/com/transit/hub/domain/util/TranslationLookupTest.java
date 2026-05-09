package com.transit.hub.domain.util;

import com.transit.hub.domain.model.Translation;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("TranslationLookup")
class TranslationLookupTest {

    @Nested
    @DisplayName("empty / null inputs")
    class EmptyInputs {

        @Test
        @DisplayName("empty() returns a lookup with no entries")
        void emptyLookup() {
            TranslationLookup lookup = TranslationLookup.empty();
            assertThat(lookup.isEmpty()).isTrue();
            assertThat(lookup.resolve("stops", "abc", "stop_name")).isEmpty();
        }

        @Test
        @DisplayName("from() with empty list returns the singleton empty lookup")
        void fromEmptyList() {
            assertThat(TranslationLookup.from(List.of()).isEmpty()).isTrue();
        }

        @Test
        @DisplayName("resolve() returns empty when any key part is null")
        void nullKeyParts() {
            TranslationLookup lookup = TranslationLookup.from(List.of(
                    translation("stops", "stop-1", "stop_name", "fr", "Gare du Nord")
            ));
            assertThat(lookup.resolve(null, "stop-1", "stop_name")).isEmpty();
            assertThat(lookup.resolve("stops", null, "stop_name")).isEmpty();
            assertThat(lookup.resolve("stops", "stop-1", null)).isEmpty();
        }
    }

    @Nested
    @DisplayName("happy path")
    class HappyPath {

        @Test
        @DisplayName("looks up a stop name by (table, record_id, field)")
        void resolveStopName() {
            TranslationLookup lookup = TranslationLookup.from(List.of(
                    translation("stops", "stop-1", "stop_name", "fr", "Gare du Nord"),
                    translation("stops", "stop-2", "stop_name", "fr", "Gare de Lyon")
            ));
            assertThat(lookup.resolve("stops", "stop-1", "stop_name"))
                    .contains("Gare du Nord");
            assertThat(lookup.resolve("stops", "stop-2", "stop_name"))
                    .contains("Gare de Lyon");
        }

        @Test
        @DisplayName("resolveOr returns the fallback when no translation exists")
        void resolveOrFallback() {
            TranslationLookup lookup = TranslationLookup.from(List.of(
                    translation("stops", "stop-1", "stop_name", "fr", "Gare du Nord")
            ));
            assertThat(lookup.resolveOr("stops", "stop-2", "stop_name", "Gare originale"))
                    .isEqualTo("Gare originale");
            assertThat(lookup.resolveOr("stops", "stop-1", "stop_name", "Gare originale"))
                    .isEqualTo("Gare du Nord");
        }

        @Test
        @DisplayName("disambiguates rows that differ only by table_name")
        void differentTablesSameRecordId() {
            TranslationLookup lookup = TranslationLookup.from(List.of(
                    translation("stops", "id-1", "name", "fr", "Gare"),
                    translation("routes", "id-1", "name", "fr", "Ligne")
            ));
            assertThat(lookup.resolve("stops", "id-1", "name")).contains("Gare");
            assertThat(lookup.resolve("routes", "id-1", "name")).contains("Ligne");
        }
    }

    @Nested
    @DisplayName("filtering")
    class Filtering {

        @Test
        @DisplayName("rows in field-value mode are indexed for resolveByFieldValue")
        void indexFieldValueMode() {
            Translation fieldValueRow = translation("stops", null, "stop_name", "fr", "Centre");
            fieldValueRow.setFieldValue("Center");
            TranslationLookup lookup = TranslationLookup.from(List.of(fieldValueRow));
            assertThat(lookup.isEmpty()).isFalse();
            assertThat(lookup.resolveByFieldValue("stops", "Center", "stop_name"))
                    .contains("Centre");
        }
    }

    private static Translation translation(String table, String recordId, String field,
                                           String language, String value) {
        return Translation.builder()
                .tableName(table)
                .recordId(recordId)
                .fieldName(field)
                .language(language)
                .translation(value)
                .build();
    }
}
