package com.transit.hub.domain.model.enums;

/**
 * Tri-state bicycle policy. {@code 0} = unknown, {@code 1} = allowed,
 * {@code 2} = not allowed.
 */
public enum BikesAllowed {
    UNKNOWN,
    ALLOWED,
    NOT_ALLOWED;

    public static BikesAllowed fromGtfs(int code) {
        return switch (code) {
            case 1 -> ALLOWED;
            case 2 -> NOT_ALLOWED;
            default -> UNKNOWN;
        };
    }
}
