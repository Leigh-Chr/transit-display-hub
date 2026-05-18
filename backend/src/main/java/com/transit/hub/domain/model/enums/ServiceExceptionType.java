package com.transit.hub.domain.model.enums;

import org.jspecify.annotations.Nullable;

/**
 * Mirrors GTFS {@code calendar_dates.exception_type}. Lets a service
 * either run on a date that the weekly pattern would have skipped
 * ({@link #ADDED}) or skip a date the weekly pattern would have served
 * ({@link #REMOVED}) — typically used for public-holiday fallbacks and
 * one-off cancellations.
 */
public enum ServiceExceptionType {
    /** GTFS code 1 — service runs on the date even if the weekly pattern says no. */
    ADDED,
    /** GTFS code 2 — service is cancelled on the date even if the weekly pattern says yes. */
    REMOVED;

    /** Returns {@code null} when the code falls outside the two values
     *  defined by the spec; the caller decides whether to drop the row
     *  or treat it as a feed-quality warning. */
    public static @Nullable ServiceExceptionType fromGtfsCode(int code) {
        return switch (code) {
            case 1 -> ADDED;
            case 2 -> REMOVED;
            default -> null;
        };
    }
}
