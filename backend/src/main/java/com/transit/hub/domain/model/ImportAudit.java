package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.ImportStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.jspecify.annotations.Nullable;

import java.time.Instant;
import java.util.UUID;

/**
 * Audit row for every GTFS import attempt — successful or failed. Distinct
 * from {@link FeedInfo} (which is the singleton describing the *current*
 * loaded feed): {@code import_audit} is append-only and serves the admin
 * timeline ("when did imports last run, what did they pull, did they fail?").
 */
@Entity
@Table(name = "import_audit",
       indexes = @Index(name = "idx_import_audit_started_at", columnList = "started_at"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ImportAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "source_url", length = 500)
    private @Nullable String sourceUrl;

    @Column(name = "source_hash", length = 64)
    private @Nullable String sourceHash;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private @Nullable Instant completedAt;

    @Column(name = "duration_ms")
    private @Nullable Long durationMs;

    @Column(name = "lines_count")
    private @Nullable Integer linesCount;

    @Column(name = "stops_count")
    private @Nullable Integer stopsCount;

    @Column(name = "itineraries_count")
    private @Nullable Integer itinerariesCount;

    @Column(name = "schedules_count")
    private @Nullable Integer schedulesCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportStatus status;

    @Column(name = "error_message", length = 1000)
    private @Nullable String errorMessage;

    /**
     * Identifier of who/what triggered the import: {@code "boot"} for the
     * one-shot loader, {@code "scheduler"} for the cron, or the username
     * for a manual API trigger.
     */
    @Column(name = "triggered_by", length = 50)
    private @Nullable String triggeredBy;

    /**
     * Filesystem directory where {@code GtfsValidatorService} wrote the
     * three MobilityData reports (report.json, report.html,
     * system_errors.json) for this import. Null when validation was
     * disabled, skipped or failed before any output landed on disk.
     */
    @Column(name = "validation_report_dir", length = 500)
    private @Nullable String validationReportDir;

    /**
     * Outcome of the {@code gtfs-validator} run, orthogonal to the
     * import {@link #status}: {@code SUCCESS} when the runner completed
     * (the feed itself may still hold ERROR-level notices),
     * {@code FAILED} when the runner threw, {@code SKIPPED} when
     * validation was disabled or no zip was retained.
     */
    @Column(name = "validation_status", length = 20)
    private @Nullable String validationStatus;

    /** Number of ERROR-level notices in the validation report — pulled
     *  out of the JSON so the admin timeline can render a badge without
     *  re-parsing the document. */
    @Column(name = "validation_notice_errors")
    private @Nullable Integer validationNoticeErrors;

    /** Number of WARNING-level notices in the validation report. */
    @Column(name = "validation_notice_warnings")
    private @Nullable Integer validationNoticeWarnings;
}
