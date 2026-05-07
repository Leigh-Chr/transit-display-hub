package com.transit.hub.domain.model.enums;

/**
 * GTFS {@code fare_attributes.payment_method} — when the fare is
 * collected. The numeric codes match the spec; we keep an enum for
 * type safety and a string column for readable DB dumps.
 */
public enum FarePaymentMethod {
    /** GTFS code 0 — fare paid on board the vehicle. */
    ON_BOARD,
    /** GTFS code 1 — fare paid before boarding (ticket / pass). */
    PREPAID;

    public static FarePaymentMethod fromGtfsCode(int code) {
        return switch (code) {
            case 0 -> ON_BOARD;
            case 1 -> PREPAID;
            default -> ON_BOARD;
        };
    }
}
