package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.LineType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateLineRequest(
        @NotBlank(message = "{validation.line.code.required}")
        @Size(max = 10, message = "{validation.line.code.size}")
        String code,

        @NotBlank(message = "{validation.line.name.required}")
        @Size(max = 100, message = "{validation.line.name.size}")
        String name,

        @NotBlank(message = "{validation.line.color.required}")
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "{validation.line.color.pattern}")
        String color,

        @NotNull(message = "{validation.line.type.required}")
        LineType type
) {}
