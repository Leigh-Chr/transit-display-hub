package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;

import java.time.Instant;
import java.util.UUID;

public record MessageResponse(
        UUID id,
        String title,
        String content,
        MessageSeverity severity,
        Instant startTime,
        Instant endTime,
        MessageScope scopeType,
        UUID scopeId,
        ScopeInfo scopeInfo,
        boolean active
) {
    public record ScopeInfo(String name) {}

    public static MessageResponse from(BroadcastMessage message, Instant evaluatedAt) {
        return from(message, null, evaluatedAt);
    }

    public static MessageResponse from(BroadcastMessage message, ScopeInfo scopeInfo, Instant evaluatedAt) {
        return new MessageResponse(
                message.getId(),
                message.getTitle(),
                message.getContent(),
                message.getSeverity(),
                message.getStartTime(),
                message.getEndTime(),
                message.getScopeType(),
                message.getScopeId(),
                scopeInfo,
                message.isActiveAt(evaluatedAt)
        );
    }
}
