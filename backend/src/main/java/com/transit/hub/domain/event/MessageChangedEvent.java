package com.transit.hub.domain.event;

import java.util.Set;
import java.util.UUID;

public final class MessageChangedEvent extends AffectedStopsEvent {
    private static final long serialVersionUID = 1L;

    public MessageChangedEvent(Object source, Set<UUID> affectedStopIds) {
        super(source, affectedStopIds);
    }
}
