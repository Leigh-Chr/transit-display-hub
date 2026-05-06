package com.transit.hub.domain.model.enums;

/**
 * GTFS {@code pathways.pathway_mode}: how a passenger physically traverses
 * the segment between two stations. The numeric codes (1..7) come from
 * the GTFS spec; we keep enum values for type safety and stable
 * persistence (string column rather than smallint).
 */
public enum PathwayMode {
    /** GTFS code 1 — flat horizontal walking surface. */
    WALKWAY,
    /** GTFS code 2 — fixed staircase. */
    STAIRS,
    /** GTFS code 3 — moving sidewalk / travelator. */
    MOVING_SIDEWALK,
    /** GTFS code 4 — escalator (one-way moving stairs). */
    ESCALATOR,
    /** GTFS code 5 — elevator / lift. */
    ELEVATOR,
    /** GTFS code 6 — fare gate (turnstile, paid-zone boundary). */
    FARE_GATE,
    /** GTFS code 7 — exit gate (one-way out of paid zone). */
    EXIT_GATE;

    public static PathwayMode fromGtfsCode(int code) {
        return switch (code) {
            case 1 -> WALKWAY;
            case 2 -> STAIRS;
            case 3 -> MOVING_SIDEWALK;
            case 4 -> ESCALATOR;
            case 5 -> ELEVATOR;
            case 6 -> FARE_GATE;
            case 7 -> EXIT_GATE;
            default -> null;
        };
    }
}
