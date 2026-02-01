package com.transit.hub.domain.event;

import org.springframework.context.ApplicationEvent;

import java.util.Set;
import java.util.UUID;

public class MessageChangedEvent extends ApplicationEvent {
    private final Set<UUID> affectedStopIds;

    public MessageChangedEvent(Object source, Set<UUID> affectedStopIds) {
        super(source);
        this.affectedStopIds = affectedStopIds;
    }

    public Set<UUID> getAffectedStopIds() {
        return affectedStopIds;
    }
}
