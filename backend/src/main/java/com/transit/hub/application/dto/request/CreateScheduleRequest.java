package com.transit.hub.application.dto.request;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;

import java.util.UUID;

public record CreateScheduleRequest(
        @NotNull(message = "{validation.schedule.time.required}")
        @Pattern(regexp = "^([01]?[0-9]|2[0-3]):[0-5][0-9]$", message = "{validation.schedule.time.pattern}")
        String time,

        @NotNull(message = "{validation.itinerary.id.required}")
        UUID itineraryId
) {}
