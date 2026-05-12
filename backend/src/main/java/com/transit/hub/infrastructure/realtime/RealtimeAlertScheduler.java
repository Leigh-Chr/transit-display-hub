package com.transit.hub.infrastructure.realtime;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.context.event.ApplicationReadyEvent;
import org.springframework.context.event.EventListener;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Polls the GTFS-Realtime alerts feed at a fixed cadence. The cron
 * uses {@code app.gtfs-rt.alerts-poll-cron} (default every 30s) so
 * operators can stretch it to once a minute on slow APIs or pin a
 * faster cycle for development.
 * <p>
 * A boot-time refresh (via {@link ApplicationReadyEvent}) ensures the
 * first kiosk request after a restart sees alerts immediately, rather
 * than waiting up to 30 s for the first cron tick.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RealtimeAlertScheduler {

    private final RealtimeAlertCache alertCache;
    private final RealtimeTripUpdateCache tripUpdateCache;
    private final RealtimeVehiclePositionCache vehiclePositionCache;

    @Value("${app.gtfs-rt.alerts-url:}")
    private String alertsUrl = "";

    @Value("${app.gtfs-rt.trip-updates-url:}")
    private String tripUpdatesUrl = "";

    @Value("${app.gtfs-rt.vehicle-positions-url:}")
    private String vehiclePositionsUrl = "";

    @EventListener(ApplicationReadyEvent.class)
    public void refreshOnStartup() {
        if (alertCache.isEnabled()) {
            log.info("GTFS-RT alerts: priming cache from {}", alertsUrl);
            alertCache.refresh();
        } else {
            log.info("GTFS-RT alerts: no app.gtfs-rt.alerts-url configured, skipping");
        }
        if (tripUpdateCache.isEnabled()) {
            log.info("GTFS-RT trip updates: priming cache from {}", tripUpdatesUrl);
            tripUpdateCache.refresh();
        } else {
            log.info("GTFS-RT trip updates: no app.gtfs-rt.trip-updates-url configured, skipping");
        }
        if (vehiclePositionCache.isEnabled()) {
            log.info("GTFS-RT vehicle positions: priming cache from {}", vehiclePositionsUrl);
            vehiclePositionCache.refresh();
        } else {
            log.info("GTFS-RT vehicle positions: no app.gtfs-rt.vehicle-positions-url configured, skipping");
        }
    }

    // Cron offsets are staggered so the three pollers don't fire on the
    // same second and pile three outbound GTFS-RT GETs on top of each
    // other (audit 2026-05-12 06-perf-observability P2). Each cron is
    // still configurable via the matching property if an operator
    // wants to align them deliberately.
    @Scheduled(cron = "${app.gtfs-rt.alerts-poll-cron:5,35 * * * * *}")
    public void scheduledAlertRefresh() {
        if (alertCache.isEnabled()) {
            alertCache.refresh();
        }
    }

    @Scheduled(cron = "${app.gtfs-rt.trip-updates-poll-cron:15,45 * * * * *}")
    public void scheduledTripUpdateRefresh() {
        if (tripUpdateCache.isEnabled()) {
            tripUpdateCache.refresh();
        }
    }

    @Scheduled(cron = "${app.gtfs-rt.vehicle-positions-poll-cron:0,20,40 * * * * *}")
    public void scheduledVehiclePositionRefresh() {
        if (vehiclePositionCache.isEnabled()) {
            vehiclePositionCache.refresh();
        }
    }
}
