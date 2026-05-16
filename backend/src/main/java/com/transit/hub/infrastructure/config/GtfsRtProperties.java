package com.transit.hub.infrastructure.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Typed view of the {@code app.gtfs-rt.*} block. Previously each of
 * the three feed caches read its URL + timeout via four separate
 * {@code @Value} annotations and the scheduler read the three URLs +
 * three crons via three more — twelve property names spread across
 * five classes. Centralising them here keeps the keys in lockstep
 * and surfaces a typo at startup (binding failure) rather than at
 * the first poll.
 *
 * <p>Empty URLs disable the corresponding poller: the cache logs a
 * "no app.gtfs-rt.*-url configured, skipping" line and serves an
 * empty optional. The default crons match the staggered schedule
 * documented in ADR 0019: alerts at sec 5/35, trip-updates at
 * 15/45, vehicle-positions at 0/20/40.
 */
@ConfigurationProperties(prefix = "app.gtfs-rt")
public record GtfsRtProperties(
        String alertsUrl,
        String tripUpdatesUrl,
        String vehiclePositionsUrl,
        String alertsPollCron,
        String tripUpdatesPollCron,
        String vehiclePositionsPollCron,
        int timeoutSeconds
) {
    public GtfsRtProperties {
        if (alertsUrl == null) {
            alertsUrl = "";
        }
        if (tripUpdatesUrl == null) {
            tripUpdatesUrl = "";
        }
        if (vehiclePositionsUrl == null) {
            vehiclePositionsUrl = "";
        }
        if (alertsPollCron == null || alertsPollCron.isBlank()) {
            alertsPollCron = "5,35 * * * * *";
        }
        if (tripUpdatesPollCron == null || tripUpdatesPollCron.isBlank()) {
            tripUpdatesPollCron = "15,45 * * * * *";
        }
        if (vehiclePositionsPollCron == null || vehiclePositionsPollCron.isBlank()) {
            vehiclePositionsPollCron = "0,20,40 * * * * *";
        }
        if (timeoutSeconds <= 0) {
            timeoutSeconds = 10;
        }
    }
}
