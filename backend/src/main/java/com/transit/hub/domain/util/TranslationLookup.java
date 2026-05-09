package com.transit.hub.domain.util;

import com.transit.hub.domain.model.Translation;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * In-memory view over a slice of {@link Translation} rows for a single
 * language. Rows are keyed by
 * {@code (table_name, record_id, record_sub_id?, field_name, language_context?)}
 * so the display calculator can swap stop / line / headsign / stop_times
 * labels in O(1) without re-querying.
 * <p>
 * Both spec matching modes are supported:
 * <ul>
 *   <li>{@code record_id} mode (the common path): scoped translations.
 *       Stop_times rows additionally carry {@code record_sub_id} which
 *       is the trip_id required to disambiguate a stop_id.</li>
 *   <li>{@code field_value} mode (rare): when {@code record_id} is
 *       absent, the translation applies to every row whose
 *       {@code field_name} equals {@code field_value}. We index those
 *       rows under a synthetic key so {@code resolveByFieldValue} can
 *       hit them in O(1).</li>
 * </ul>
 * {@code language_context} (long-form vs short-form variants) is part
 * of the key so multiple translations for the same record/field can
 * coexist; callers requesting a context get the matching variant or
 * fall back to the default (null context).
 */
public final class TranslationLookup {

    private static final TranslationLookup EMPTY = new TranslationLookup(Map.of(), Map.of());

    /** Field separator inside the composite map key. {@code U+001F} is
     *  the ASCII "unit separator" — never appears in GTFS strings, so
     *  no risk of "stops|123" colliding with "stop|s123". */
    private static final char SEP = '';

    private final Map<String, String> byRecordKey;
    private final Map<String, String> byFieldValueKey;

    private TranslationLookup(Map<String, String> byRecordKey, Map<String, String> byFieldValueKey) {
        this.byRecordKey = byRecordKey;
        this.byFieldValueKey = byFieldValueKey;
    }

    public static TranslationLookup empty() {
        return EMPTY;
    }

    public static TranslationLookup from(Collection<Translation> translations) {
        if (translations == null || translations.isEmpty()) {
            return EMPTY;
        }
        Map<String, String> byRecord = new HashMap<>(translations.size() * 2);
        Map<String, String> byFieldValue = new HashMap<>();
        for (Translation t : translations) {
            if (t.getTableName() == null
                    || t.getFieldName() == null
                    || t.getTranslation() == null) {
                continue;
            }
            if (t.getRecordId() != null) {
                byRecord.put(recordKey(t.getTableName(), t.getRecordId(), t.getRecordSubId(),
                                       t.getFieldName(), t.getLanguageContext()),
                             t.getTranslation());
            } else if (t.getFieldValue() != null) {
                byFieldValue.put(fieldValueKey(t.getTableName(), t.getFieldValue(),
                                               t.getFieldName(), t.getLanguageContext()),
                                 t.getTranslation());
            }
        }
        return new TranslationLookup(byRecord, byFieldValue);
    }

    /** Resolve a translation by record id (the common path). Tries the
     *  context-specific key first, then falls back to the default. */
    public Optional<String> resolve(String tableName, String recordId, String fieldName) {
        return resolve(tableName, recordId, null, fieldName, null);
    }

    /** Full lookup including {@code record_sub_id} (for stop_times)
     *  and {@code language_context} (long-form / short-form). */
    public Optional<String> resolve(String tableName, String recordId, String recordSubId,
                                    String fieldName, String languageContext) {
        if (tableName == null || recordId == null || fieldName == null) {
            return Optional.empty();
        }
        String contextKey = recordKey(tableName, recordId, recordSubId, fieldName, languageContext);
        String hit = byRecordKey.get(contextKey);
        if (hit != null) {
            return Optional.of(hit);
        }
        // Fall back to the default-context entry, then to a record_sub_id-less entry
        if (languageContext != null) {
            String defaultContext = recordKey(tableName, recordId, recordSubId, fieldName, null);
            String fallback = byRecordKey.get(defaultContext);
            if (fallback != null) {return Optional.of(fallback);}
        }
        if (recordSubId != null) {
            String noSub = recordKey(tableName, recordId, null, fieldName, null);
            return Optional.ofNullable(byRecordKey.get(noSub));
        }
        return Optional.empty();
    }

    /** GTFS spec's {@code field_value} matching mode — translate every
     *  row whose {@code field_name} equals the given value. Use case:
     *  one translation row covers "Direction" across hundreds of stops. */
    public Optional<String> resolveByFieldValue(String tableName, String fieldValue, String fieldName) {
        return resolveByFieldValue(tableName, fieldValue, fieldName, null);
    }

    public Optional<String> resolveByFieldValue(String tableName, String fieldValue,
                                                String fieldName, String languageContext) {
        if (tableName == null || fieldValue == null || fieldName == null) {
            return Optional.empty();
        }
        String key = fieldValueKey(tableName, fieldValue, fieldName, languageContext);
        String hit = byFieldValueKey.get(key);
        if (hit != null) {return Optional.of(hit);}
        if (languageContext != null) {
            return Optional.ofNullable(
                    byFieldValueKey.get(fieldValueKey(tableName, fieldValue, fieldName, null)));
        }
        return Optional.empty();
    }

    /** Convenience overload — returns the original value when no
     *  translation is found. Saves callers from writing
     *  {@code .orElse(original)} on every site. */
    public String resolveOr(String tableName, String recordId, String fieldName, String fallback) {
        return resolve(tableName, recordId, fieldName).orElse(fallback);
    }

    public boolean isEmpty() {
        return byRecordKey.isEmpty() && byFieldValueKey.isEmpty();
    }

    private static String recordKey(String tableName, String recordId, String recordSubId,
                                    String fieldName, String languageContext) {
        return tableName + SEP + recordId + SEP + (recordSubId == null ? "" : recordSubId)
                + SEP + fieldName + SEP + (languageContext == null ? "" : languageContext);
    }

    private static String fieldValueKey(String tableName, String fieldValue,
                                        String fieldName, String languageContext) {
        return tableName + SEP + fieldValue + SEP + fieldName
                + SEP + (languageContext == null ? "" : languageContext);
    }
}
