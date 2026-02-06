package com.transit.hub.infrastructure.websocket;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;
import org.springframework.web.socket.messaging.SessionSubscribeEvent;
import org.springframework.web.socket.messaging.SessionUnsubscribeEvent;

import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("ActiveDisplayTracker")
class ActiveDisplayTrackerTest {

    private ActiveDisplayTracker tracker;

    @BeforeEach
    void setUp() {
        tracker = new ActiveDisplayTracker();
    }

    private SessionSubscribeEvent createSubscribeEvent(String sessionId, String subscriptionId, String destination) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
        accessor.setSessionId(sessionId);
        accessor.setSubscriptionId(subscriptionId);
        accessor.setDestination(destination);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        return new SessionSubscribeEvent(this, message);
    }

    private SessionUnsubscribeEvent createUnsubscribeEvent(String sessionId, String subscriptionId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.UNSUBSCRIBE);
        accessor.setSessionId(sessionId);
        accessor.setSubscriptionId(subscriptionId);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        return new SessionUnsubscribeEvent(this, message);
    }

    private SessionDisconnectEvent createDisconnectEvent(String sessionId) {
        StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.DISCONNECT);
        accessor.setSessionId(sessionId);
        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        return new SessionDisconnectEvent(this, message, sessionId, null);
    }

    @Nested
    @DisplayName("handleSubscribe()")
    class HandleSubscribe {

        @Test
        @DisplayName("adds stop and session for display topic")
        void addsStopAndSession() {
            UUID stopId = UUID.randomUUID();
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/display/" + stopId));

            assertThat(tracker.getActiveStopIds()).containsExactly(stopId);
            assertThat(tracker.hasActiveSubscriptions(stopId)).isTrue();
        }

        @Test
        @DisplayName("ignores non-display destinations")
        void ignoresNonDisplayDestinations() {
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/other/something"));

            assertThat(tracker.getActiveStopIds()).isEmpty();
        }

        @Test
        @DisplayName("handles null destination")
        void handlesNullDestination() {
            StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
            accessor.setSessionId("session1");
            accessor.setSubscriptionId("sub1");
            // No destination set
            Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
            SessionSubscribeEvent event = new SessionSubscribeEvent(this, message);

            tracker.handleSubscribe(event);

            assertThat(tracker.getActiveStopIds()).isEmpty();
        }

        @Test
        @DisplayName("handles null session ID")
        void handlesNullSessionId() {
            StompHeaderAccessor accessor = StompHeaderAccessor.create(StompCommand.SUBSCRIBE);
            accessor.setDestination("/topic/display/" + UUID.randomUUID());
            accessor.setSubscriptionId("sub1");
            // No session ID set
            Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
            SessionSubscribeEvent event = new SessionSubscribeEvent(this, message);

            tracker.handleSubscribe(event);

            assertThat(tracker.getActiveStopIds()).isEmpty();
        }
    }

    @Nested
    @DisplayName("handleUnsubscribe()")
    class HandleUnsubscribe {

        @Test
        @DisplayName("removes the subscription")
        void removesSubscription() {
            UUID stopId = UUID.randomUUID();
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/display/" + stopId));
            assertThat(tracker.hasActiveSubscriptions(stopId)).isTrue();

            tracker.handleUnsubscribe(createUnsubscribeEvent("session1", "sub1"));

            assertThat(tracker.hasActiveSubscriptions(stopId)).isFalse();
            assertThat(tracker.getActiveStopIds()).isEmpty();
        }

        @Test
        @DisplayName("handles unsubscribe for unknown session")
        void handlesUnknownSession() {
            tracker.handleUnsubscribe(createUnsubscribeEvent("unknown-session", "sub1"));

            assertThat(tracker.getActiveStopIds()).isEmpty();
        }
    }

    @Nested
    @DisplayName("handleDisconnect()")
    class HandleDisconnect {

        @Test
        @DisplayName("removes all subscriptions for the session")
        void removesAllSubscriptionsForSession() {
            UUID stopId1 = UUID.randomUUID();
            UUID stopId2 = UUID.randomUUID();
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/display/" + stopId1));
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub2", "/topic/display/" + stopId2));

            tracker.handleDisconnect(createDisconnectEvent("session1"));

            assertThat(tracker.getActiveStopIds()).isEmpty();
            assertThat(tracker.hasActiveSubscriptions(stopId1)).isFalse();
            assertThat(tracker.hasActiveSubscriptions(stopId2)).isFalse();
        }

        @Test
        @DisplayName("handles disconnect for unknown session")
        void handlesUnknownSession() {
            tracker.handleDisconnect(createDisconnectEvent("unknown-session"));

            assertThat(tracker.getActiveStopIds()).isEmpty();
        }
    }

    @Nested
    @DisplayName("getActiveStopIds()")
    class GetActiveStopIds {

        @Test
        @DisplayName("returns stops with active subscribers")
        void returnsActiveStops() {
            UUID stopId1 = UUID.randomUUID();
            UUID stopId2 = UUID.randomUUID();
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/display/" + stopId1));
            tracker.handleSubscribe(createSubscribeEvent("session2", "sub2", "/topic/display/" + stopId2));

            Set<UUID> activeStopIds = tracker.getActiveStopIds();

            assertThat(activeStopIds).containsExactlyInAnyOrder(stopId1, stopId2);
        }

        @Test
        @DisplayName("returns empty set when no subscribers")
        void returnsEmptyWhenNoSubscribers() {
            assertThat(tracker.getActiveStopIds()).isEmpty();
        }
    }

    @Nested
    @DisplayName("hasActiveSubscriptions()")
    class HasActiveSubscriptions {

        @Test
        @DisplayName("returns true when stop has subscribers")
        void returnsTrueWhenHasSubscribers() {
            UUID stopId = UUID.randomUUID();
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/display/" + stopId));

            assertThat(tracker.hasActiveSubscriptions(stopId)).isTrue();
        }

        @Test
        @DisplayName("returns false when stop has no subscribers")
        void returnsFalseWhenNoSubscribers() {
            UUID stopId = UUID.randomUUID();

            assertThat(tracker.hasActiveSubscriptions(stopId)).isFalse();
        }
    }

    @Nested
    @DisplayName("Multiple sessions on same stop")
    class MultipleSessions {

        @Test
        @DisplayName("manages correctly when multiple sessions subscribe to same stop")
        void multipleSessionsSameStop() {
            UUID stopId = UUID.randomUUID();
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/display/" + stopId));
            tracker.handleSubscribe(createSubscribeEvent("session2", "sub2", "/topic/display/" + stopId));

            assertThat(tracker.hasActiveSubscriptions(stopId)).isTrue();

            // Remove one session
            tracker.handleDisconnect(createDisconnectEvent("session1"));

            // Still has the other session
            assertThat(tracker.hasActiveSubscriptions(stopId)).isTrue();
            assertThat(tracker.getActiveStopIds()).containsExactly(stopId);

            // Remove second session
            tracker.handleDisconnect(createDisconnectEvent("session2"));

            assertThat(tracker.hasActiveSubscriptions(stopId)).isFalse();
            assertThat(tracker.getActiveStopIds()).isEmpty();
        }
    }

    @Nested
    @DisplayName("Session with multiple stops")
    class SessionMultipleStops {

        @Test
        @DisplayName("manages correctly when one session subscribes to multiple stops")
        void oneSessionMultipleStops() {
            UUID stopId1 = UUID.randomUUID();
            UUID stopId2 = UUID.randomUUID();
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub1", "/topic/display/" + stopId1));
            tracker.handleSubscribe(createSubscribeEvent("session1", "sub2", "/topic/display/" + stopId2));

            assertThat(tracker.getActiveStopIds()).containsExactlyInAnyOrder(stopId1, stopId2);

            // Unsubscribe from one
            tracker.handleUnsubscribe(createUnsubscribeEvent("session1", "sub1"));

            assertThat(tracker.hasActiveSubscriptions(stopId1)).isFalse();
            assertThat(tracker.hasActiveSubscriptions(stopId2)).isTrue();
        }
    }
}
