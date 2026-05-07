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

    @Value("${app.gtfs-rt.alerts-url:}")
    private String alertsUrl = "";

    @Value("${app.gtfs-rt.trip-updates-url:}")
    private String tripUpdatesUrl = "";

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
    }

    @Scheduled(cron = "${app.gtfs-rt.alerts-poll-cron:*/30 * * * * *}")
    public void scheduledAlertRefresh() {
        if (alertCache.isEnabled()) {
            alertCache.refresh();
        }
    }

    @Scheduled(cron = "${app.gtfs-rt.trip-updates-poll-cron:*/30 * * * * *}")
    public void scheduledTripUpdateRefresh() {
        if (tripUpdateCache.isEnabled()) {
            tripUpdateCache.refresh();
        }
    }
}
