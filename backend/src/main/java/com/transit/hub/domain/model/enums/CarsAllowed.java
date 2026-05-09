package com.transit.hub.domain.model.enums;

/**
 * Tri-state car (motor vehicle) policy on a multimodal service —
 * mostly used by ferries and motorail trains. {@code 0} = unknown,
 * {@code 1} = allowed, {@code 2} = not allowed.
 */
public enum CarsAllowed {
    UNKNOWN,
    ALLOWED,
    NOT_ALLOWED;

    public static CarsAllowed fromGtfs(int code) {
        return switch (code) {
            case 1 -> ALLOWED;
            case 2 -> NOT_ALLOWED;
            default -> UNKNOWN;
        };
    }
}
