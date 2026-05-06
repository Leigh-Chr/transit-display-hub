package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.service.DisplayStateCalculator;
import com.transit.hub.infrastructure.websocket.ActiveDisplayTracker;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DisplayStateService")
class DisplayStateServiceTest {

    @Mock
    private DisplayStateCalculator displayStateCalculator;

    @Mock
    private SimpMessagingTemplate messagingTemplate;

    @Mock
    private ActiveDisplayTracker activeDisplayTracker;

    @InjectMocks
    private DisplayStateService displayStateService;

    private UUID stopId;
    private DisplayState mockState;

    @BeforeEach
    void setUp() {
        stopId = UUID.randomUUID();
        mockState = new DisplayState(
                stopId, "Central Station", null, null,
                List.of(), List.of(), List.of(),
                1L, Instant.now()
        );
    }

    @Nested
    @DisplayName("getDisplayState()")
    class GetDisplayState {

        @Test
        @DisplayName("delegates to calculator")
        void delegatesToCalculator() {
            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);

            DisplayState result = displayStateService.getDisplayState(stopId);

            assertThat(result).isEqualTo(mockState);
            verify(displayStateCalculator).calculateForStop(stopId);
        }
    }

    @Nested
    @DisplayName("recalculateAndPush()")
    class RecalculateAndPush {

        @Test
        @DisplayName("calculates and sends to correct topic")
        void calculatesAndSendsToTopic() {
            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);

            displayStateService.recalculateAndPush(stopId);

            verify(displayStateCalculator).calculateForStop(stopId);
            verify(messagingTemplate).convertAndSend("/topic/display/" + stopId, mockState);
        }

        @Test
        @DisplayName("handles exception silently")
        void handlesExceptionSilently() {
            when(displayStateCalculator.calculateForStop(stopId)).thenThrow(new RuntimeException("test error"));

            // Should not throw
            displayStateService.recalculateAndPush(stopId);

            verify(messagingTemplate, never()).convertAndSend(anyString(), any(DisplayState.class));
        }
    }

    @Nested
    @DisplayName("recalculateAndPushAll()")
    class RecalculateAndPushAll {

        @Test
        @DisplayName("iterates over active stop IDs only")
        void iteratesOverActiveStopIds() {
            UUID stopId2 = UUID.randomUUID();
            UUID stopId3 = UUID.randomUUID();
            DisplayState state2 = new DisplayState(stopId2, "North Station", null, null, List.of(), List.of(), List.of(), 2L, Instant.now());
            DisplayState state3 = new DisplayState(stopId3, "South Station", null, null, List.of(), List.of(), List.of(), 3L, Instant.now());

            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);
            when(displayStateCalculator.calculateForStop(stopId2)).thenReturn(state2);
            when(displayStateCalculator.calculateForStop(stopId3)).thenReturn(state3);
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(stopId, stopId2, stopId3));

            displayStateService.recalculateAndPushAll(Set.of(stopId, stopId2, stopId3));

            verify(displayStateCalculator, times(3)).calculateForStop(any());
            verify(messagingTemplate, times(3)).convertAndSend(anyString(), any(DisplayState.class));
        }

        @Test
        @DisplayName("skips stops without an active subscription")
        void skipsInactiveStops() {
            UUID inactiveStop = UUID.randomUUID();
            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(stopId));

            displayStateService.recalculateAndPushAll(Set.of(stopId, inactiveStop));

            verify(displayStateCalculator).calculateForStop(stopId);
            verify(displayStateCalculator, never()).calculateForStop(inactiveStop);
        }
    }

    @Nested
    @DisplayName("onScheduleChanged()")
    class OnScheduleChanged {

        @Test
        @DisplayName("recalculates affected stop")
        void recalculatesAffectedStop() {
            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);

            ScheduleChangedEvent event = new ScheduleChangedEvent(this, stopId);
            displayStateService.onScheduleChanged(event);

            verify(displayStateCalculator).calculateForStop(stopId);
            verify(messagingTemplate).convertAndSend("/topic/display/" + stopId, mockState);
        }
    }

    @Nested
    @DisplayName("onMessageChanged()")
    class OnMessageChanged {

        @Test
        @DisplayName("recalculates all affected stops")
        void recalculatesAllAffectedStops() {
            UUID stopId2 = UUID.randomUUID();
            DisplayState state2 = new DisplayState(stopId2, "North Station", null, null, List.of(), List.of(), List.of(), 2L, Instant.now());

            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);
            when(displayStateCalculator.calculateForStop(stopId2)).thenReturn(state2);
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(stopId, stopId2));

            MessageChangedEvent event = new MessageChangedEvent(this, Set.of(stopId, stopId2));
            displayStateService.onMessageChanged(event);

            verify(displayStateCalculator).calculateForStop(stopId);
            verify(displayStateCalculator).calculateForStop(stopId2);
        }
    }

    @Nested
    @DisplayName("onNetworkChanged()")
    class OnNetworkChanged {

        @Test
        @DisplayName("recalculates all affected stops")
        void recalculatesAllAffectedStops() {
            UUID stopId2 = UUID.randomUUID();
            DisplayState state2 = new DisplayState(stopId2, "North Station", null, null, List.of(), List.of(), List.of(), 2L, Instant.now());

            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);
            when(displayStateCalculator.calculateForStop(stopId2)).thenReturn(state2);
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(stopId, stopId2));

            NetworkChangedEvent event = new NetworkChangedEvent(this, Set.of(stopId, stopId2));
            displayStateService.onNetworkChanged(event);

            verify(displayStateCalculator).calculateForStop(stopId);
            verify(displayStateCalculator).calculateForStop(stopId2);
        }
    }

    @Nested
    @DisplayName("refreshActiveDisplays()")
    class RefreshActiveDisplays {

        @Test
        @DisplayName("refreshes only stops with active subscribers")
        void refreshesActiveStops() {
            UUID stopId2 = UUID.randomUUID();
            DisplayState state2 = new DisplayState(stopId2, "North Station", null, null, List.of(), List.of(), List.of(), 2L, Instant.now());

            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(stopId, stopId2));
            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);
            when(displayStateCalculator.calculateForStop(stopId2)).thenReturn(state2);

            displayStateService.refreshActiveDisplays();

            verify(displayStateCalculator).calculateForStop(stopId);
            verify(displayStateCalculator).calculateForStop(stopId2);
            verify(messagingTemplate, times(2)).convertAndSend(anyString(), any(DisplayState.class));
        }

        @Test
        @DisplayName("does nothing when no active subscribers")
        void doesNothingWhenNoSubscribers() {
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of());

            displayStateService.refreshActiveDisplays();

            verify(displayStateCalculator, never()).calculateForStop(any());
            verify(messagingTemplate, never()).convertAndSend(anyString(), any(DisplayState.class));
        }
    }

    @Nested
    @DisplayName("recalculateAndPush() - error handling")
    class RecalculateAndPushErrorHandling {

        @Test
        @DisplayName("does not rethrow when calculator throws exception")
        void doesNotRethrowOnCalculatorException() {
            when(displayStateCalculator.calculateForStop(stopId))
                    .thenThrow(new RuntimeException("Database connection failed"));

            // Should not throw -- error is caught and logged
            displayStateService.recalculateAndPush(stopId);

            verify(messagingTemplate, never()).convertAndSend(anyString(), any(DisplayState.class));
        }

        @Test
        @DisplayName("does not rethrow when messaging template throws exception")
        void doesNotRethrowOnMessagingException() {
            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);
            doThrow(new RuntimeException("WebSocket send failed"))
                    .when(messagingTemplate).convertAndSend(anyString(), any(DisplayState.class));

            // Should not throw -- error is caught and logged
            displayStateService.recalculateAndPush(stopId);
        }
    }

    @Nested
    @DisplayName("recalculateAndPushAll() - partial failure")
    class RecalculateAndPushAllPartialFailure {

        @Test
        @DisplayName("continues processing remaining stops when one fails")
        void continuesWhenOneStopFails() {
            UUID stopId2 = UUID.randomUUID();
            UUID stopId3 = UUID.randomUUID();
            DisplayState state3 = new DisplayState(stopId3, "South Station", null, null, List.of(), List.of(), List.of(), 3L, Instant.now());

            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);
            when(displayStateCalculator.calculateForStop(stopId2)).thenThrow(new RuntimeException("Stop 2 failed"));
            when(displayStateCalculator.calculateForStop(stopId3)).thenReturn(state3);
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(stopId, stopId2, stopId3));

            displayStateService.recalculateAndPushAll(Set.of(stopId, stopId2, stopId3));

            // All three stops should be attempted
            verify(displayStateCalculator).calculateForStop(stopId);
            verify(displayStateCalculator).calculateForStop(stopId2);
            verify(displayStateCalculator).calculateForStop(stopId3);
            // Only the two successful ones should be sent
            verify(messagingTemplate).convertAndSend("/topic/display/" + stopId, mockState);
            verify(messagingTemplate, never()).convertAndSend(eq("/topic/display/" + stopId2), any(DisplayState.class));
            verify(messagingTemplate).convertAndSend("/topic/display/" + stopId3, state3);
        }
    }

    @Nested
    @DisplayName("WebSocket topic path")
    class WebSocketTopicPath {

        @Test
        @DisplayName("sends to /topic/display/{stopId} path format")
        void sendsToCorrectTopicPath() {
            when(displayStateCalculator.calculateForStop(stopId)).thenReturn(mockState);

            displayStateService.recalculateAndPush(stopId);

            String expectedTopic = "/topic/display/" + stopId;
            verify(messagingTemplate).convertAndSend(eq(expectedTopic), eq(mockState));
        }
    }
}
