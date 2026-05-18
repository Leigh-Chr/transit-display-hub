package com.transit.hub.application.service;

import com.transit.hub.application.exception.ImportAlreadyRunningException;
import com.transit.hub.domain.model.ImportAudit;
import com.transit.hub.domain.model.enums.ImportStatus;
import com.transit.hub.infrastructure.metrics.GtfsImportMetrics;
import com.transit.hub.infrastructure.persistence.ImportAuditRepository;
import com.transit.hub.infrastructure.seed.gtfs.GtfsDownloader;
import com.transit.hub.infrastructure.seed.gtfs.GtfsImportService;
import io.micrometer.core.instrument.Timer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.springframework.cache.CacheManager;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Covers the orchestrator's three terminal outcomes plus the lock
 * contention path. The audit row mutation is verified through an
 * {@link ArgumentCaptor} so we assert against the same object the
 * production code persists.
 */
class GtfsImportOrchestratorTest {

    private GtfsDownloader downloader;
    private GtfsImportService importer;
    private ImportAuditRepository auditRepository;
    private CacheManager cacheManager;
    private GtfsImportMetrics metrics;
    private GtfsValidatorService validator;
    private Clock clock;

    private GtfsImportOrchestrator orchestrator;

    @TempDir
    Path tempDir;

    @BeforeEach
    void setUp() {
        downloader = mock(GtfsDownloader.class);
        importer = mock(GtfsImportService.class);
        auditRepository = mock(ImportAuditRepository.class);
        cacheManager = mock(CacheManager.class);
        metrics = mock(GtfsImportMetrics.class);
        validator = mock(GtfsValidatorService.class);
        clock = Clock.fixed(Instant.parse("2026-05-18T10:00:00Z"), ZoneOffset.UTC);

        when(auditRepository.save(any())).thenAnswer(inv -> {
            ImportAudit a = inv.getArgument(0);
            if (a.getId() == null) {
                a.setId(UUID.randomUUID());
            }
            return a;
        });
        when(metrics.startSample()).thenReturn(mock(Timer.Sample.class));

        orchestrator = new GtfsImportOrchestrator(
                downloader, importer, auditRepository, cacheManager, metrics, validator, clock);
    }

    @Test
    void runImport_success_writesSuccessAuditAndRecordsMetrics() throws Exception {
        Path feed = Files.writeString(tempDir.resolve("feed.zip"), "fake-content").toAbsolutePath();
        when(downloader.downloadOrCached("http://feed")).thenReturn(feed);
        when(importer.importFromZip(any(), any(), any()))
                .thenReturn(new GtfsImportService.ImportResult(2, 30, 4, 60, 1200));
        when(auditRepository.findLastSuccessfulWithHash()).thenReturn(Optional.empty());

        // Validation disabled-by-default would skip; force-enable via the field
        // (the validator mock returns no result by default, so we keep validation
        // disabled implicitly by leaving the @Value-injected boolean at its
        // default false in unit tests).

        GtfsImportOrchestrator.ImportOutcome outcome = orchestrator.runImport("http://feed", "test");

        assertEquals(ImportStatus.SUCCESS, outcome.status());
        assertNotNull(outcome.result());
        assertEquals(1200, outcome.result().schedules());

        ArgumentCaptor<ImportAudit> captor = ArgumentCaptor.forClass(ImportAudit.class);
        verify(auditRepository, times(2)).save(captor.capture());
        ImportAudit finalAudit = captor.getAllValues().get(1);
        assertEquals(ImportStatus.SUCCESS, finalAudit.getStatus());
        assertEquals(2, finalAudit.getLinesCount());
        assertEquals(30, finalAudit.getStopsCount());
        assertEquals(1200, finalAudit.getSchedulesCount());

        verify(metrics).recordSuccess(any(), eqL(2), eqL(30), eqL(1200));
    }

    @Test
    void runImport_skipsWhenHashMatchesLastSuccess() throws Exception {
        Path feed = Files.writeString(tempDir.resolve("feed.zip"), "same-bytes").toAbsolutePath();
        when(downloader.downloadOrCached("http://feed")).thenReturn(feed);

        // Compute the same sha-256 the orchestrator would compute and stub the
        // repository to return a previous audit row carrying it. The orchestrator
        // must skip the import without calling the importer.
        ImportAudit previous = new ImportAudit();
        previous.setSourceHash(sha256("same-bytes"));
        when(auditRepository.findLastSuccessfulWithHash()).thenReturn(Optional.of(previous));

        GtfsImportOrchestrator.ImportOutcome outcome = orchestrator.runImport("http://feed", "test");

        assertEquals(ImportStatus.SKIPPED_UNCHANGED, outcome.status());
        verify(importer, never()).importFromZip(any(), any(), any());
        verify(metrics).recordSkipped();
    }

    @Test
    void runImport_recordsFailureWhenDownloaderThrows() throws Exception {
        when(downloader.downloadOrCached("http://feed"))
                .thenThrow(new RuntimeException("network down"));

        GtfsImportOrchestrator.ImportOutcome outcome = orchestrator.runImport("http://feed", "test");

        assertEquals(ImportStatus.FAILED, outcome.status());
        ArgumentCaptor<ImportAudit> captor = ArgumentCaptor.forClass(ImportAudit.class);
        verify(auditRepository, times(2)).save(captor.capture());
        ImportAudit finalAudit = captor.getAllValues().get(1);
        assertEquals(ImportStatus.FAILED, finalAudit.getStatus());
        assertEquals("network down", finalAudit.getErrorMessage());
        verify(metrics).recordFailure(any());
    }

    @Test
    void runImport_returnsSkippedWhenLockAlreadyHeld() throws Exception {
        Path feed = Files.writeString(tempDir.resolve("feed.zip"), "x").toAbsolutePath();
        when(downloader.downloadOrCached(any())).thenAnswer(inv -> {
            // Hold the lock for as long as we're inside the importer.
            Thread.sleep(120);
            return feed;
        });
        when(importer.importFromZip(any(), any(), any()))
                .thenReturn(new GtfsImportService.ImportResult(0, 0, 0, 0, 0));
        when(auditRepository.findLastSuccessfulWithHash()).thenReturn(Optional.empty());

        Thread first = new Thread(() -> orchestrator.runImport("http://feed", "long"));
        first.start();
        // Give the first thread time to enter the locked section.
        Thread.sleep(40);

        GtfsImportOrchestrator.ImportOutcome contended = orchestrator.runImport("http://feed", "second");
        assertEquals(ImportStatus.SKIPPED_UNCHANGED, contended.status());
        assertEquals("Another import is already running", contended.message());

        first.join();
    }

    @Test
    void runImportAsync_throwsWhenLockAlreadyHeld() throws Exception {
        Path feed = Files.writeString(tempDir.resolve("feed.zip"), "x").toAbsolutePath();
        when(downloader.downloadOrCached(any())).thenAnswer(inv -> {
            Thread.sleep(120);
            return feed;
        });
        when(importer.importFromZip(any(), any(), any()))
                .thenReturn(new GtfsImportService.ImportResult(0, 0, 0, 0, 0));
        when(auditRepository.findLastSuccessfulWithHash()).thenReturn(Optional.empty());

        Thread first = new Thread(() -> orchestrator.runImport("http://feed", "long"));
        first.start();
        Thread.sleep(40);

        assertThrows(ImportAlreadyRunningException.class,
                () -> orchestrator.runImportAsync("http://feed", "second"));

        first.join();
    }

    private static String sha256(String content) throws Exception {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        return java.util.HexFormat.of().formatHex(md.digest(content.getBytes()));
    }

    private static long eqL(long v) { return org.mockito.ArgumentMatchers.eq(v); }
}
