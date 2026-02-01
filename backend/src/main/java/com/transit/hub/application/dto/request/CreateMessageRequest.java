package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record CreateMessageRequest(
        @NotBlank(message = "Title is required")
        @Size(max = 100, message = "Title must be at most 100 characters")
        String title,

        @NotBlank(message = "Content is required")
        @Size(max = 500, message = "Content must be at most 500 characters")
        String content,

        @NotNull(message = "Severity is required")
        MessageSeverity severity,

        @NotNull(message = "Start time is required")
        Instant startTime,

        @NotNull(message = "End time is required")
        Instant endTime,

        @NotNull(message = "Scope type is required")
        MessageScope scopeType,

        UUID scopeId
) {}
