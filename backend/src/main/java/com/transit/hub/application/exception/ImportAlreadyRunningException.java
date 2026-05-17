package com.transit.hub.application.exception;

/**
 * Raised by the GTFS import orchestrator when an admin (or scheduler) triggers
 * a re-import while another one is still running. Surfaced as HTTP 409 Conflict
 * with the {@code error.gtfs.importAlreadyRunning} i18n key by
 * {@link com.transit.hub.api.advice.GlobalExceptionHandler}.
 */
public class ImportAlreadyRunningException extends RuntimeException {

    private static final long serialVersionUID = 1L;

    private final String messageKey;

    public ImportAlreadyRunningException(String messageKey) {
        super(messageKey);
        this.messageKey = messageKey;
    }

    public String getMessageKey() {
        return messageKey;
    }
}
