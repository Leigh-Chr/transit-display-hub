package com.transit.hub.domain.event;

import org.springframework.context.ApplicationEvent;

import java.util.Set;
import java.util.UUID;

/**
 * Parent for domain events that signal a change touching a finite set
 * of stops. Listeners discriminate on the concrete subclass to decide
 * what kind of refresh to push to subscribers: {@link MessageChangedEvent}
 * triggers the broadcast-message overlay, {@link NetworkChangedEvent}
 * triggers the network-map snapshot. The shared payload lives here so
 * the two subclasses stay 1-liners.
 */
public abstract sealed class AffectedStopsEvent extends ApplicationEvent
        permits MessageChangedEvent, NetworkChangedEvent {

    private static final long serialVersionUID = 1L;

    private final Set<UUID> affectedStopIds;

    protected AffectedStopsEvent(Object source, Set<UUID> affectedStopIds) {
        super(source);
        this.affectedStopIds = affectedStopIds;
    }

    public Set<UUID> getAffectedStopIds() {
        return affectedStopIds;
    }
}
