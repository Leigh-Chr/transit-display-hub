package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.service.DisplayStateCalculator;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DisplayStateService {

    private final DisplayStateCalculator displayStateCalculator;
    private final SimpMessagingTemplate messagingTemplate;

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
        for (UUID stopId : stopIds) {
            recalculateAndPush(stopId);
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
    public void onNetworkChanged(NetworkChangedEvent event) {
        log.info("Network changed, affecting {} stops", event.getAffectedStopIds().size());
        recalculateAndPushAll(event.getAffectedStopIds());
    }
}
