package com.transit.hub.domain.util;

import com.transit.hub.domain.model.Translation;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

/**
 * In-memory view over a slice of {@link Translation} rows for a single
 * language. Rows are keyed by {@code (table_name, record_id, field_name)}
 * so the display calculator can swap stop / line / headsign labels in
 * O(1) without re-querying.
 * <p>
 * Only the {@code record_id} matching mode is honoured: the GTFS
 * spec's alternative {@code field_value} mode (one translation
 * applying to every row whose field equals a value) is rare enough
 * that we leave it out of the runtime path. The persisted column is
 * still there if a future phase wants to add the second mode.
 */
public final class TranslationLookup {

    private static final TranslationLookup EMPTY = new TranslationLookup(Map.of());

    /** Field separator inside the composite map key. {@code U+001F} is
     *  the ASCII "unit separator" — never appears in GTFS strings, so
     *  no risk of "stops|123" colliding with "stop|s123". */
    private static final char SEP = '';

    private final Map<String, String> byKey;

    private TranslationLookup(Map<String, String> byKey) {
        this.byKey = byKey;
    }

    public static TranslationLookup empty() {
        return EMPTY;
    }

    public static TranslationLookup from(Collection<Translation> translations) {
        if (translations == null || translations.isEmpty()) {
            return EMPTY;
        }
        Map<String, String> map = new HashMap<>(translations.size() * 2);
        for (Translation t : translations) {
            if (t.getRecordId() == null
                    || t.getTableName() == null
                    || t.getFieldName() == null
                    || t.getTranslation() == null) {
                continue;
            }
            map.put(key(t.getTableName(), t.getRecordId(), t.getFieldName()), t.getTranslation());
        }
        return new TranslationLookup(map);
    }

    public Optional<String> resolve(String tableName, String recordId, String fieldName) {
        if (tableName == null || recordId == null || fieldName == null) {
            return Optional.empty();
        }
        return Optional.ofNullable(byKey.get(key(tableName, recordId, fieldName)));
    }

    /** Convenience overload — returns the original value when no
     *  translation is found. Saves callers from writing
     *  {@code .orElse(original)} on every site. */
    public String resolveOr(String tableName, String recordId, String fieldName, String fallback) {
        return resolve(tableName, recordId, fieldName).orElse(fallback);
    }

    public boolean isEmpty() {
        return byKey.isEmpty();
    }

    private static String key(String tableName, String recordId, String fieldName) {
        return tableName + SEP + recordId + SEP + fieldName;
    }
}
