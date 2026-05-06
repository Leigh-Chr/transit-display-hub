package com.transit.hub.domain.model.enums;

public enum ImportStatus {
    /** Import is currently running. */
    RUNNING,
    /** Completed without exception, all entities persisted. */
    SUCCESS,
    /** Skipped because the feed hash matched the existing FeedInfo. */
    SKIPPED_UNCHANGED,
    /** Threw before completing — see {@code errorMessage} on the audit row. */
    FAILED
}
