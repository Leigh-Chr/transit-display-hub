package com.transit.hub.domain.event;

import org.springframework.context.ApplicationEvent;

import java.util.UUID;

/**
 * Emitted right before a Stop is deleted. Captures the name so listeners can
 * still produce a meaningful message after the row is gone (e.g. tell kiosks
 * subscribed to /topic/display/{stopId} that their stop no longer exists).
 */
public class StopDeletedEvent extends ApplicationEvent {
    private static final long serialVersionUID = 1L;

    private final UUID stopId;
    private final String stopName;

    public StopDeletedEvent(Object source, UUID stopId, String stopName) {
        super(source);
        this.stopId = stopId;
        this.stopName = stopName;
    }

    public UUID getStopId() {
        return stopId;
    }

    public String getStopName() {
        return stopName;
    }
}
