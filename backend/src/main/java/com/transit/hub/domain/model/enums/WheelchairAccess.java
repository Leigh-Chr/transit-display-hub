package com.transit.hub.domain.model.enums;

/**
 * Tri-state wheelchair accessibility, mirroring GTFS conventions:
 * {@code 0} = unknown, {@code 1} = accessible, {@code 2} = not accessible.
 */
public enum WheelchairAccess {
    UNKNOWN,
    ACCESSIBLE,
    NOT_ACCESSIBLE;

    public static WheelchairAccess fromGtfs(int code) {
        return switch (code) {
            case 1 -> ACCESSIBLE;
            case 2 -> NOT_ACCESSIBLE;
            default -> UNKNOWN;
        };
    }
}
