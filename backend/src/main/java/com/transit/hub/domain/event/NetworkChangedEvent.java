package com.transit.hub.domain.event;

import java.util.Set;
import java.util.UUID;

public final class NetworkChangedEvent extends AffectedStopsEvent {
    private static final long serialVersionUID = 1L;

    public NetworkChangedEvent(Object source, Set<UUID> affectedStopIds) {
        super(source, affectedStopIds);
    }
}
