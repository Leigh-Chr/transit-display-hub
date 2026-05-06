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
    private String sourceUrl;

    @Column(name = "source_hash", length = 64)
    private String sourceHash;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "completed_at")
    private Instant completedAt;

    @Column(name = "duration_ms")
    private Long durationMs;

    @Column(name = "lines_count")
    private Integer linesCount;

    @Column(name = "stops_count")
    private Integer stopsCount;

    @Column(name = "itineraries_count")
    private Integer itinerariesCount;

    @Column(name = "schedules_count")
    private Integer schedulesCount;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ImportStatus status;

    @Column(name = "error_message", length = 1000)
    private String errorMessage;

    /**
     * Identifier of who/what triggered the import: {@code "boot"} for the
     * one-shot loader, {@code "scheduler"} for the cron, or the username
     * for a manual API trigger.
     */
    @Column(name = "triggered_by", length = 50)
    private String triggeredBy;
}
