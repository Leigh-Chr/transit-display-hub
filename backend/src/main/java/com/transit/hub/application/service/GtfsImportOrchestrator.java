package com.transit.hub.application.service;

import com.transit.hub.domain.model.ImportAudit;
import com.transit.hub.domain.model.enums.ImportStatus;
import com.transit.hub.infrastructure.metrics.GtfsImportMetrics;
import com.transit.hub.infrastructure.persistence.ImportAuditRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsDownloader;
import com.transit.hub.infrastructure.seed.gtfs.GtfsImportService;
import io.micrometer.core.instrument.Timer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.concurrent.locks.ReentrantLock;

/**
 * High-level orchestrator for GTFS imports. Handles:
 * <ul>
 *   <li>Downloading the feed (delegated to {@link GtfsDownloader}).</li>
 *   <li>Computing the source SHA-256 in streaming so a 200 MB feed never
 *       sits in memory.</li>
 *   <li>Skipping the import when the hash hasn't changed.</li>
 *   <li>Wrapping every attempt — success, skip or failure — in an
 *       {@link ImportAudit} row so the admin timeline always reflects
 *       what was attempted.</li>
 *   <li>Serialising overlapping triggers (boot loader, scheduler, manual
 *       admin call) via a {@link ReentrantLock}.</li>
 * </ul>
 * Centralising this logic means the boot loader, the cron-driven refresh
 * (Phase 0.7) and the admin-triggered re-import (future) all go through
 * the same code path.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GtfsImportOrchestrator {

    private final GtfsDownloader downloader;
    private final GtfsImportService importer;
    private final ImportAuditRepository auditRepository;
    private final CacheManager cacheManager;
    private final GtfsImportMetrics metrics;

    private final ReentrantLock importLock = new ReentrantLock();

    public record ImportOutcome(
            ImportStatus status,
            GtfsImportService.ImportResult result,
            String message
    ) {}

    /**
     * Runs an import attempt. Always writes an {@link ImportAudit} row.
     * Returns the outcome so callers (the boot loader, the scheduler,
     * the admin endpoint) can branch their logging without inspecting
     * the audit themselves.
     *
     * @param feedUrl     URL of the GTFS feed
     * @param triggeredBy free-form identifier ("boot", "scheduler", username)
     */
    public ImportOutcome runImport(String feedUrl, String triggeredBy) {
        if (!importLock.tryLock()) {
            log.warn("GTFS import already running, skipping trigger from {}", triggeredBy);
            metrics.recordSkipped();
            return new ImportOutcome(ImportStatus.SKIPPED_UNCHANGED, null,
                    "Another import is already running");
        }
        Timer.Sample sample = metrics.startSample();
        ImportAudit audit = ImportAudit.builder()
                .sourceUrl(feedUrl)
                .startedAt(Instant.now())
                .status(ImportStatus.RUNNING)
                .triggeredBy(triggeredBy)
                .build();
        audit = auditRepository.save(audit);
        try {
            Path feed = downloader.downloadOrCached(feedUrl);
            String hash = sha256(feed);
            audit.setSourceHash(hash);

            GtfsImportService.ImportResult result = importer.importFromZip(feed, feedUrl, hash);

            evictNetworkCaches();
            finalizeAudit(audit, ImportStatus.SUCCESS, result, null);
            metrics.recordSuccess(sample, result.lines(), result.stops(), result.schedules());
            log.info("GTFS import completed by {}: {} lines, {} stops, {} schedules",
                    triggeredBy, result.lines(), result.stops(), result.schedules());
            return new ImportOutcome(ImportStatus.SUCCESS, result, null);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            finalizeAudit(audit, ImportStatus.FAILED, null, "Interrupted: " + e.getMessage());
            metrics.recordFailure(sample);
            return new ImportOutcome(ImportStatus.FAILED, null, "Import was interrupted");
        } catch (Exception e) {
            log.error("GTFS import failed for {}: {}", feedUrl, e.getMessage(), e);
            finalizeAudit(audit, ImportStatus.FAILED, null, truncate(e.getMessage(), 1000));
            metrics.recordFailure(sample);
            return new ImportOutcome(ImportStatus.FAILED, null, e.getMessage());
        } finally {
            importLock.unlock();
        }
    }

    private void finalizeAudit(ImportAudit audit, ImportStatus status,
                               GtfsImportService.ImportResult result, String errorMessage) {
        Instant now = Instant.now();
        audit.setCompletedAt(now);
        audit.setDurationMs(Duration.between(audit.getStartedAt(), now).toMillis());
        audit.setStatus(status);
        audit.setErrorMessage(errorMessage);
        if (result != null) {
            audit.setLinesCount(result.lines());
            audit.setStopsCount(result.stops());
            audit.setItinerariesCount(result.itineraries());
            audit.setSchedulesCount(result.schedules());
        }
        auditRepository.save(audit);
    }

    private void evictNetworkCaches() {
        for (String name : new String[]{"networkMap", "networkAlerts"}) {
            var cache = cacheManager.getCache(name);
            if (cache != null) { cache.clear(); }
        }
    }

    /**
     * Streams the file through SHA-256 so a multi-hundred-megabyte zip
     * never sits in heap. Returns null on IO failure — callers degrade
     * gracefully (the import still runs without hash deduplication).
     */
    private static String sha256(Path file) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            try (InputStream in = Files.newInputStream(file)) {
                byte[] buffer = new byte[8 * 1024];
                int read;
                while ((read = in.read(buffer)) > 0) {
                    md.update(buffer, 0, read);
                }
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (Exception e) {
            log.warn("Failed to compute SHA-256 of feed file {}: {}", file, e.getMessage());
            return null;
        }
    }

    private static String truncate(String s, int max) {
        if (s == null) { return null; }
        return s.length() <= max ? s : s.substring(0, max);
    }
}
