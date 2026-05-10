package com.transit.hub.domain.event;

import org.springframework.context.ApplicationEvent;

import java.util.UUID;

public class ScheduleChangedEvent extends ApplicationEvent {
    private static final long serialVersionUID = 1L;

    private final UUID stopId;

    public ScheduleChangedEvent(Object source, UUID stopId) {
        super(source);
        this.stopId = stopId;
    }

    public UUID getStopId() {
        return stopId;
    }
}
