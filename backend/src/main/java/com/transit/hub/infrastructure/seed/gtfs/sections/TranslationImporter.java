package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Translation;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Optional;
import java.util.Set;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code translations.txt} and replaces the {@link Translation} table on
 * every import. The spec requires {@code (table_name, record_id, field_name, language)}
 * or {@code (table_name, field_value, field_name, language)} as the row identifier;
 * both halves are persisted so the runtime lookup can prefer the record-id form.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TranslationImporter {

    private final TranslationRepository translationRepository;

    /**
     * Wipes the translations table and re-imports from {@code translations.txt}.
     * Absent file is silently skipped.
     */
    public void importTranslations(Path translationsFile) throws IOException {
        // (table, record_id|field_value, field, lang) seen-set so feeds with
        // duplicate translation rows don't blow up the unique constraint.
        Set<String> seen = new HashSet<>();
        GtfsSectionImporter.runWithStats(
                translationRepository,
                translationsFile,
                "translations",
                (record, skip) -> mapRow(record, seen, skip),
                log
        );
    }

    private static Optional<Translation> mapRow(
            CSVRecord record,
            Set<String> seen,
            GtfsSectionImporter.SkipTracker skip
    ) {
        String tableName = optional(record, "table_name");
        String fieldName = optional(record, "field_name");
        String language = optional(record, "language");
        String translationValue = optional(record, "translation");
        if (isBlank(tableName) || isBlank(fieldName) || isBlank(language)
                || isBlank(translationValue)) {
            return Optional.empty();
        }
        String recordId = optional(record, "record_id");
        String fieldValue = optional(record, "field_value");
        if (isBlank(recordId) && isBlank(fieldValue)) {
            return Optional.empty();
        }
        String recordSubId = optional(record, "record_sub_id");
        String languageContext = optional(record, "language_context");
        String dedupeKey = tableName + "|" + (isBlank(recordId) ? fieldValue : recordId)
                + "|" + (recordSubId == null ? "" : recordSubId)
                + "|" + fieldName + "|" + language;
        if (!seen.add(dedupeKey)) {
            skip.skip("duplicate");
            return Optional.empty();
        }
        return Optional.of(Translation.builder()
                .tableName(truncate(tableName, 60))
                .recordId(isBlank(recordId) ? null : truncate(recordId.trim(), 100))
                .fieldValue(isBlank(fieldValue) ? null : truncate(fieldValue.trim(), 200))
                .recordSubId(isBlank(recordSubId) ? null : truncate(recordSubId.trim(), 100))
                .languageContext(isBlank(languageContext) ? null
                        : truncate(languageContext.trim(), 100))
                .fieldName(truncate(fieldName, 60))
                .language(truncate(language.trim(), 20))
                .translation(translationValue)
                .build());
    }
}
