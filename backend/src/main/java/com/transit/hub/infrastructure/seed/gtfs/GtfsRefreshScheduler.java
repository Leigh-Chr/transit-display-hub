package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.application.service.GtfsImportOrchestrator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Cron-driven refresh of the GTFS feed. Defaults to 04:00 every day in the
 * server's timezone — well outside passenger peak hours, after most
 * agencies publish their nightly updates.
 * <p>
 * Activated by {@code app.data-loader.source=gtfs}; the orchestrator's
 * lock guarantees this never runs concurrently with the boot loader or a
 * future admin-triggered refresh.
 * <p>
 * Disable by overriding {@code app.data-loader.gtfs.refresh-cron=-} (any
 * invalid cron switches Spring's parser off without throwing on boot).
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.data-loader.source", havingValue = "gtfs")
public class GtfsRefreshScheduler {

    private final GtfsImportOrchestrator orchestrator;

    @Value("${app.data-loader.gtfs.url}")
    private String feedUrl;

    @Scheduled(cron = "${app.data-loader.gtfs.refresh-cron:0 0 4 * * *}")
    public void refresh() {
        if (feedUrl == null || feedUrl.isBlank()) {
            log.debug("GTFS refresh scheduler skipped: no feed URL configured");
            return;
        }
        log.info("GTFS refresh scheduler firing for {}", feedUrl);
        orchestrator.runImport(feedUrl, "scheduler");
    }
}
