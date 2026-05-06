package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.ImportAudit;
import com.transit.hub.domain.model.enums.ImportStatus;

import java.time.Instant;
import java.util.UUID;

public record ImportAuditResponse(
        UUID id,
        String sourceUrl,
        String sourceHash,
        Instant startedAt,
        Instant completedAt,
        Long durationMs,
        Integer linesCount,
        Integer stopsCount,
        Integer itinerariesCount,
        Integer schedulesCount,
        ImportStatus status,
        String errorMessage,
        String triggeredBy
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
                audit.getTriggeredBy()
        );
    }
}
