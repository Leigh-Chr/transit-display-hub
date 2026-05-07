package com.transit.hub.domain.model.enums;

/**
 * GTFS {@code booking_rules.booking_type} — when a passenger has to
 * book the demand-responsive trip. The numeric codes match the spec;
 * the enum keeps a readable string in the DB and at the wire.
 */
public enum BookingType {
    /** GTFS code 0 — bookable on the same day as the trip. */
    REAL_TIME,
    /** GTFS code 1 — bookable on the same day, with a minimum notice
     *  period (carried by {@code prior_notice_duration_min}). */
    SAME_DAY,
    /** GTFS code 2 — must be booked at least one prior day, possibly
     *  before a per-day cutoff. */
    PRIOR_DAYS;

    public static BookingType fromGtfsCode(int code) {
        return switch (code) {
            case 0 -> REAL_TIME;
            case 1 -> SAME_DAY;
            case 2 -> PRIOR_DAYS;
            default -> null;
        };
    }
}
