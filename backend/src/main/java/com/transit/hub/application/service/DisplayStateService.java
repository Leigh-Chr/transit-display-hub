package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.event.StopDeletedEvent;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.domain.service.DisplayStateCalculator;
import com.transit.hub.infrastructure.websocket.ActiveDisplayTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DisplayStateService {

    private final DisplayStateCalculator displayStateCalculator;
    private final SimpMessagingTemplate messagingTemplate;
    private final ActiveDisplayTracker activeDisplayTracker;

    public DisplayState getDisplayState(UUID stopId) {
        return displayStateCalculator.calculateForStop(stopId);
    }

    public void recalculateAndPush(UUID stopId) {
        try {
            DisplayState state = displayStateCalculator.calculateForStop(stopId);
            String destination = "/topic/display/" + stopId;
            messagingTemplate.convertAndSend(destination, state);
            log.debug("Pushed DisplayState to {}, version {}", destination, state.version());
        } catch (Exception e) {
            log.error("Failed to push DisplayState for stop {}", stopId, e);
        }
    }

    public void recalculateAndPushAll(Set<UUID> stopIds) {
        // A NETWORK-scope event yields every stop in the system, but only the
        // ones with a live STOMP subscription will actually consume the push.
        // Restricting to active stops avoids fan-outs of thousands of pushes
        // (1 SQL recalc + 1 broadcast per stop) on every network-wide message.
        Set<UUID> activeStops = activeDisplayTracker.getActiveStopIds();
        for (UUID stopId : stopIds) {
            if (activeStops.contains(stopId)) {
                recalculateAndPush(stopId);
            }
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onScheduleChanged(ScheduleChangedEvent event) {
        log.info("Schedule changed for stop {}", event.getStopId());
        recalculateAndPush(event.getStopId());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageChanged(MessageChangedEvent event) {
        log.info("Message changed, affecting {} stops", event.getAffectedStopIds().size());
        recalculateAndPushAll(event.getAffectedStopIds());
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onStopDeleted(StopDeletedEvent event) {
        log.info("Stop {} deleted, notifying subscribed kiosks", event.getStopId());
        // The stop row is gone, so calculateForStop would throw. Push a final
        // state with a clear CRITICAL message so kiosks subscribed to the topic
        // surface the change instead of silently freezing on stale data.
        DisplayState farewell = new DisplayState(
                event.getStopId(),
                event.getStopName(),
                null,
                null,
                List.of(),
                List.of(),
                List.of(new DisplayState.MessageInfo(
                        "Stop removed",
                        "This stop is no longer in service.",
                        MessageSeverity.CRITICAL)),
                Long.MAX_VALUE,
                Instant.now()
        );
        try {
            messagingTemplate.convertAndSend("/topic/display/" + event.getStopId(), farewell);
        } catch (Exception e) {
            log.error("Failed to push stop-deleted notice for {}", event.getStopId(), e);
        }
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onNetworkChanged(NetworkChangedEvent event) {
        log.info("Network changed, affecting {} stops", event.getAffectedStopIds().size());
        recalculateAndPushAll(event.getAffectedStopIds());
    }

    @Scheduled(fixedRate = 60000) // Every minute
    public void refreshActiveDisplays() {
        Set<UUID> activeStopIds = activeDisplayTracker.getActiveStopIds();
        if (!activeStopIds.isEmpty()) {
            log.debug("Refreshing {} active displays", activeStopIds.size());
            recalculateAndPushAll(activeStopIds);
        }
    }
}
