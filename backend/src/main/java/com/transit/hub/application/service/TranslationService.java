package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.TranslationResponse;
import com.transit.hub.domain.model.Translation;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TranslationService {

    private final TranslationRepository translationRepository;

    /**
     * Browse translations for an admin. {@code language} is required —
     * the table can hold tens of thousands of rows across multiple
     * languages, returning all of them at once would be wasteful.
     * {@code tableName} narrows further when set.
     */
    @Transactional(readOnly = true)
    public List<TranslationResponse> browse(String language, String tableName) {
        List<Translation> rows = (tableName == null || tableName.isBlank())
                ? translationRepository.findByLanguage(language)
                : translationRepository.findByLanguageAndTableName(language, tableName);
        return rows.stream()
                .sorted(Comparator
                        .comparing((Translation t) -> t.getTableName() == null ? "" : t.getTableName())
                        .thenComparing(t -> t.getFieldName() == null ? "" : t.getFieldName())
                        .thenComparing(t -> t.getRecordId() == null ? "" : t.getRecordId()))
                .map(TranslationResponse::from)
                .toList();
    }
}
