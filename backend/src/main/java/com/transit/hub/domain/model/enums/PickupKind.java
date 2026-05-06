package com.transit.hub.domain.model.enums;

/**
 * Passenger-facing summary of GTFS {@code pickup_type} and {@code drop_off_type}.
 * Combining both axes into a single user-friendly label keeps the kiosk
 * markup simple — most rows are {@link #NORMAL}, the rest deserve a
 * visible badge ("on request", "drop off only").
 */
public enum PickupKind {
    /** Both pickup and drop-off available without conditions (default). */
    NORMAL,
    /** Drop-off only — vehicles do not pick up new passengers here. */
    DROP_OFF_ONLY,
    /** Pick-up only — vehicles do not let passengers off here. */
    PICKUP_ONLY,
    /** Pickup or drop-off requires phoning the agency (GTFS code 2). */
    ON_REQUEST_AGENCY,
    /** Pickup or drop-off requires coordinating with the driver (GTFS code 3). */
    ON_REQUEST_DRIVER;

    /**
     * Resolves a passenger-facing kind from the two GTFS axes. The (1, 1)
     * "no service" pair never reaches this method because the importer
     * filters those rows out, but we still handle it defensively.
     */
    public static PickupKind from(short pickupType, short dropOffType) {
        if (pickupType == 1 && dropOffType == 1) {return NORMAL;} // unreachable in practice
        if (pickupType == 1) {return DROP_OFF_ONLY;}
        if (dropOffType == 1) {return PICKUP_ONLY;}
        if (pickupType == 2 || dropOffType == 2) {return ON_REQUEST_AGENCY;}
        if (pickupType == 3 || dropOffType == 3) {return ON_REQUEST_DRIVER;}
        return NORMAL;
    }
}
