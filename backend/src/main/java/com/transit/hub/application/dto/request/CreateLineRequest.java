package com.transit.hub.application.dto.request;

import com.transit.hub.domain.model.enums.LineType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record CreateLineRequest(
        @NotBlank(message = "Code is required")
        @Size(max = 10, message = "Code must be at most 10 characters")
        String code,

        @NotBlank(message = "Name is required")
        @Size(max = 100, message = "Name must be at most 100 characters")
        String name,

        @NotBlank(message = "Color is required")
        @Pattern(regexp = "^#[0-9A-Fa-f]{6}$", message = "Color must be a valid hex color (e.g., #FF5733)")
        String color,

        @NotNull(message = "Type is required")
        LineType type
) {}
