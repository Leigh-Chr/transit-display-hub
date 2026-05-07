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

    private final RealtimeAlertCache cache;

    @Value("${app.gtfs-rt.alerts-url:}")
    private String alertsUrl = "";

    @EventListener(ApplicationReadyEvent.class)
    public void refreshOnStartup() {
        if (alertsUrl == null || alertsUrl.isBlank()) {
            log.info("GTFS-RT alerts: no app.gtfs-rt.alerts-url configured, skipping realtime");
            return;
        }
        log.info("GTFS-RT alerts: priming cache from {}", alertsUrl);
        cache.refresh();
    }

    @Scheduled(cron = "${app.gtfs-rt.alerts-poll-cron:*/30 * * * * *}")
    public void scheduledRefresh() {
        if (alertsUrl == null || alertsUrl.isBlank()) {
            return;
        }
        cache.refresh();
    }
}
