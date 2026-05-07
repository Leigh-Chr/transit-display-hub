package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Translation;

import java.util.UUID;

/**
 * Read-only DTO for the admin browse endpoint over GTFS
 * {@code translations.txt}. Surfaces the polymorphic key
 * ({@code tableName}, {@code recordId}, {@code fieldName}) plus the
 * {@code language} and {@code translation} so admins can audit which
 * rows were imported and how the kiosk would render them.
 */
public record TranslationResponse(
        UUID id,
        String tableName,
        String recordId,
        String fieldValue,
        String fieldName,
        String language,
        String translation
) {
    public static TranslationResponse from(Translation t) {
        return new TranslationResponse(
                t.getId(),
                t.getTableName(),
                t.getRecordId(),
                t.getFieldValue(),
                t.getFieldName(),
                t.getLanguage(),
                t.getTranslation()
        );
    }
}
