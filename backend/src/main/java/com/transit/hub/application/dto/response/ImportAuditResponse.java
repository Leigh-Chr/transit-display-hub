package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.ImportAudit;
import com.transit.hub.domain.model.enums.ImportStatus;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

public record ImportAuditResponse(
        UUID id,
        @Nullable String sourceUrl,
        @Nullable String sourceHash,
        Instant startedAt,
        @Nullable Instant completedAt,
        @Nullable Long durationMs,
        @Nullable Integer linesCount,
        @Nullable Integer stopsCount,
        @Nullable Integer itinerariesCount,
        @Nullable Integer schedulesCount,
        ImportStatus status,
        @Nullable String errorMessage,
        @Nullable String triggeredBy,
        @Nullable String validationStatus,
        @Nullable Integer validationNoticeErrors,
        @Nullable Integer validationNoticeWarnings
) {
    public static ImportAuditResponse from(ImportAudit audit) {
        return new ImportAuditResponse(
                audit.getId(),
                audit.getSourceUrl(),
                audit.getSourceHash(),
                audit.getStartedAt(),
                audit.getCompletedAt(),
                audit.getDurationMs(),
                audit.getLinesCount(),
                audit.getStopsCount(),
                audit.getItinerariesCount(),
                audit.getSchedulesCount(),
                audit.getStatus(),
                audit.getErrorMessage(),
                audit.getTriggeredBy(),
                audit.getValidationStatus(),
                audit.getValidationNoticeErrors(),
                audit.getValidationNoticeWarnings()
        );
    }
}
