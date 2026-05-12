package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.UUID;

public record CreateMessageRequest(
        @NotBlank(message = "{validation.message.title.required}")
        @Size(max = 100, message = "{validation.message.title.size}")
        String title,

        @NotBlank(message = "{validation.message.content.required}")
        @Size(max = 500, message = "{validation.message.content.size}")
        String content,

        @NotNull(message = "{validation.message.severity.required}")
        MessageSeverity severity,

        @NotNull(message = "{validation.message.startTime.required}")
        Instant startTime,

        @NotNull(message = "{validation.message.endTime.required}")
        Instant endTime,

        @NotNull(message = "{validation.message.scopeType.required}")
        MessageScope scopeType,

        UUID scopeId
) {}
