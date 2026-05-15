package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateMessageRequest;
import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.websocket.ActiveDisplayTracker;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("MessageService")
class MessageServiceTest {

    @Mock
    private BroadcastMessageRepository messageRepository;

    @Mock
    private LineRepository lineRepository;

    @Mock
    private StopRepository stopRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @Mock
    private MessageScopeResolver scopeResolver;

    @Mock
    private ActiveDisplayTracker activeDisplayTracker;

    @org.mockito.Spy
    private java.time.Clock clock = java.time.Clock.systemDefaultZone();

    @InjectMocks
    private MessageService messageService;

    private Line testLine;
    private Stop testStop;
    private UUID testLineId;
    private UUID testStopId;
    private UUID testMessageId;
    private Instant now;
    private Instant futureTime;

    @BeforeEach
    void setUp() {
        testLineId = UUID.randomUUID();
        testStopId = UUID.randomUUID();
        testMessageId = UUID.randomUUID();
        testLine = TestDataFactory.createLineWithId(testLineId, "L1", "Metro Line 1", "#FF5733");
        testStop = TestDataFactory.createStopWithId(testStopId, "Central Station", testLine);
        now = Instant.now();
        futureTime = now.plus(1, ChronoUnit.HOURS);
        // The service now blocks NETWORK-scope mutations from non-admins; seed
        // an admin principal so the existing scope tests still exercise the
        // happy path. Per-test overrides remain free to clear or replace it.
        SecurityContextHolder.getContext().setAuthentication(
                new TestingAuthenticationToken("admin", null, "ROLE_ADMIN"));

        // Default stubs for the scope resolver so tests that don't care about
        // scope resolution don't need to set up the resolver themselves.
        // lenient() avoids UnnecessaryStubbingException in tests that never
        // call the list/paginated query paths.
        lenient().when(scopeResolver.bulkLineNames(anyList())).thenReturn(Map.of());
        lenient().when(scopeResolver.bulkStopNames(anyList())).thenReturn(Map.of());
        lenient().when(scopeResolver.toResponse(any(BroadcastMessage.class), anyMap(), anyMap()))
                .thenAnswer(inv -> MessageResponse.from(inv.getArgument(0)));
    }

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("createMessage - Scope Validation")
    class CreateMessageScopeValidation {

        @Test
        @DisplayName("creates NETWORK scope message with null scopeId")
        void networkScope_SavesWithNullScopeId() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Network Alert",
                    "System-wide maintenance",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.NETWORK,
                    null
            );
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(testStopId));
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            MessageResponse result = messageService.createMessage(request);

            assertThat(result.scopeType()).isEqualTo(MessageScope.NETWORK);
            assertThat(result.scopeId()).isNull();

            ArgumentCaptor<BroadcastMessage> captor = ArgumentCaptor.forClass(BroadcastMessage.class);
            verify(messageRepository).save(captor.capture());
            assertThat(captor.getValue().getScopeType()).isEqualTo(MessageScope.NETWORK);
            assertThat(captor.getValue().getScopeId()).isNull();
        }

        @Test
        @DisplayName("throws ValidationException for NETWORK scope with scopeId")
        void networkScopeWithScopeId_ThrowsValidation() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Network Alert",
                    "Invalid scope",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.NETWORK,
                    UUID.randomUUID()
            );

            assertThatThrownBy(() -> messageService.createMessage(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("NETWORK")
                    .hasMessageContaining("null");

            verify(messageRepository, never()).save(any());
        }

        @Test
        @DisplayName("creates LINE scope message with valid lineId")
        void lineScope_RequiresScopeId() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Line Alert",
                    "Line-specific message",
                    MessageSeverity.WARNING,
                    now,
                    futureTime,
                    MessageScope.LINE,
                    testLineId
            );
            when(lineRepository.existsById(testLineId)).thenReturn(true);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of(testStop));
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            MessageResponse result = messageService.createMessage(request);

            assertThat(result.scopeType()).isEqualTo(MessageScope.LINE);
            assertThat(result.scopeId()).isEqualTo(testLineId);
        }

        @Test
        @DisplayName("throws ValidationException for LINE scope without scopeId")
        void lineScopeWithoutScopeId_ThrowsValidation() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Line Alert",
                    "Missing scope",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.LINE,
                    null
            );

            assertThatThrownBy(() -> messageService.createMessage(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("LINE")
                    .hasMessageContaining("required");

            verify(messageRepository, never()).save(any());
        }

        @Test
        @DisplayName("throws EntityNotFoundException for LINE scope with non-existent line")
        void lineScopeWithNonExistentLine_ThrowsNotFound() {
            UUID nonExistentLineId = UUID.randomUUID();
            CreateMessageRequest request = new CreateMessageRequest(
                    "Line Alert",
                    "Non-existent line",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.LINE,
                    nonExistentLineId
            );
            when(lineRepository.existsById(nonExistentLineId)).thenReturn(false);

            assertThatThrownBy(() -> messageService.createMessage(request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");

            verify(messageRepository, never()).save(any());
        }

        @Test
        @DisplayName("creates STOP scope message with valid stopId")
        void stopScope_RequiresScopeId() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Stop Alert",
                    "Stop-specific message",
                    MessageSeverity.CRITICAL,
                    now,
                    futureTime,
                    MessageScope.STOP,
                    testStopId
            );
            when(stopRepository.existsById(testStopId)).thenReturn(true);
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            MessageResponse result = messageService.createMessage(request);

            assertThat(result.scopeType()).isEqualTo(MessageScope.STOP);
            assertThat(result.scopeId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws ValidationException for STOP scope without scopeId")
        void stopScopeWithoutScopeId_ThrowsValidation() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Stop Alert",
                    "Missing scope",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.STOP,
                    null
            );

            assertThatThrownBy(() -> messageService.createMessage(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("STOP")
                    .hasMessageContaining("required");

            verify(messageRepository, never()).save(any());
        }

        @Test
        @DisplayName("throws EntityNotFoundException for STOP scope with non-existent stop")
        void stopScopeWithNonExistentStop_ThrowsNotFound() {
            UUID nonExistentStopId = UUID.randomUUID();
            CreateMessageRequest request = new CreateMessageRequest(
                    "Stop Alert",
                    "Non-existent stop",
                    MessageSeverity.INFO,
                    now,
                    futureTime,
                    MessageScope.STOP,
                    nonExistentStopId
            );
            when(stopRepository.existsById(nonExistentStopId)).thenReturn(false);

            assertThatThrownBy(() -> messageService.createMessage(request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");

            verify(messageRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("createMessage - Time Validation")
    class CreateMessageTimeValidation {

        @Test
        @DisplayName("throws ValidationException when startTime is after endTime")
        void startTimeAfterEndTime_ThrowsValidation() {
            Instant startTime = now.plus(2, ChronoUnit.HOURS);
            Instant endTime = now.plus(1, ChronoUnit.HOURS);
            CreateMessageRequest request = new CreateMessageRequest(
                    "Invalid Time",
                    "Start after end",
                    MessageSeverity.INFO,
                    startTime,
                    endTime,
                    MessageScope.NETWORK,
                    null
            );

            assertThatThrownBy(() -> messageService.createMessage(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("Start time")
                    .hasMessageContaining("before");

            verify(messageRepository, never()).save(any());
        }

        @Test
        @DisplayName("allows startTime equal to endTime")
        void startTimeEqualToEndTime_Succeeds() {
            Instant sameTime = now.plus(1, ChronoUnit.HOURS);
            CreateMessageRequest request = new CreateMessageRequest(
                    "Instant Message",
                    "Same start and end",
                    MessageSeverity.INFO,
                    sameTime,
                    sameTime.plusMillis(1), // Must be at least slightly after
                    MessageScope.NETWORK,
                    null
            );
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of());
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            // Should not throw
            assertThatCode(() -> messageService.createMessage(request)).doesNotThrowAnyException();
        }
    }

    @Nested
    @DisplayName("createMessage - Event Publishing")
    class CreateMessageEventPublishing {

        @Test
        @DisplayName("publishes MessageChangedEvent for active NETWORK message")
        void activeNetworkMessage_PublishesEventForAllStops() {
            UUID stop2Id = UUID.randomUUID();
            CreateMessageRequest request = new CreateMessageRequest(
                    "Network Alert",
                    "Active message",
                    MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS),
                    now.plus(1, ChronoUnit.HOURS),
                    MessageScope.NETWORK,
                    null
            );
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(testStopId, stop2Id));
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            messageService.createMessage(request);

            ArgumentCaptor<MessageChangedEvent> eventCaptor = ArgumentCaptor.forClass(MessageChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getAffectedStopIds()).hasSize(2);
        }

        @Test
        @DisplayName("publishes MessageChangedEvent for active LINE message")
        void activeLineMessage_PublishesEventForLineStops() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Line Alert",
                    "Active message",
                    MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS),
                    now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE,
                    testLineId
            );
            when(lineRepository.existsById(testLineId)).thenReturn(true);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of(testStop));
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            messageService.createMessage(request);

            ArgumentCaptor<MessageChangedEvent> eventCaptor = ArgumentCaptor.forClass(MessageChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getAffectedStopIds()).contains(testStopId);
        }

        @Test
        @DisplayName("publishes MessageChangedEvent for active STOP message")
        void activeStopMessage_PublishesEventForSingleStop() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Stop Alert",
                    "Active message",
                    MessageSeverity.INFO,
                    now.minus(1, ChronoUnit.HOURS),
                    now.plus(1, ChronoUnit.HOURS),
                    MessageScope.STOP,
                    testStopId
            );
            when(stopRepository.existsById(testStopId)).thenReturn(true);
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            messageService.createMessage(request);

            ArgumentCaptor<MessageChangedEvent> eventCaptor = ArgumentCaptor.forClass(MessageChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getAffectedStopIds()).containsExactly(testStopId);
        }

        @Test
        @DisplayName("does not publish event for future message")
        void futureMessage_DoesNotPublishEvent() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Future Alert",
                    "Not yet active",
                    MessageSeverity.INFO,
                    now.plus(1, ChronoUnit.HOURS),
                    now.plus(2, ChronoUnit.HOURS),
                    MessageScope.NETWORK,
                    null
            );
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(testStopId));
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            messageService.createMessage(request);

            verify(eventPublisher, never()).publishEvent(any(MessageChangedEvent.class));
        }
    }

    @Nested
    @DisplayName("getAllMessages")
    class GetAllMessages {

        @Test
        @DisplayName("returns all messages")
        void returnsAllMessages() {
            BroadcastMessage msg1 = TestDataFactory.createNetworkMessage();
            BroadcastMessage msg2 = TestDataFactory.createLineMessage(testLineId);
            when(messageRepository.findAll(any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(msg1, msg2)));

            List<MessageResponse> result = messageService.getAllMessages();

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("returns empty list when no messages")
        void returnsEmptyWhenNoMessages() {
            when(messageRepository.findAll(any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of()));

            List<MessageResponse> result = messageService.getAllMessages();

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getActiveMessages")
    class GetActiveMessages {

        @Test
        @DisplayName("returns only active messages")
        void returnsOnlyActiveMessages() {
            BroadcastMessage activeMsg = TestDataFactory.createNetworkMessage();
            when(messageRepository.findActiveMessages(any(Instant.class))).thenReturn(List.of(activeMsg));

            List<MessageResponse> result = messageService.getActiveMessages();

            assertThat(result).hasSize(1);
            verify(messageRepository).findActiveMessages(any(Instant.class));
        }
    }

    @Nested
    @DisplayName("getMessage")
    class GetMessage {

        @Test
        @DisplayName("returns message when found")
        void returnsMessageWhenFound() {
            BroadcastMessage message = TestDataFactory.createNetworkMessage();
            message.setId(testMessageId);
            when(messageRepository.findById(testMessageId)).thenReturn(Optional.of(message));

            MessageResponse result = messageService.getMessage(testMessageId);

            assertThat(result.id()).isEqualTo(testMessageId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(messageRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> messageService.getMessage(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Message");
        }
    }

    @Nested
    @DisplayName("updateMessage")
    class UpdateMessage {

        @Test
        @DisplayName("updates message and publishes event")
        void updatesAndPublishesEvent() {
            BroadcastMessage existing = TestDataFactory.createNetworkMessage();
            existing.setId(testMessageId);
            CreateMessageRequest request = new CreateMessageRequest(
                    "Updated Title",
                    "Updated content",
                    MessageSeverity.WARNING,
                    now,
                    futureTime,
                    MessageScope.NETWORK,
                    null
            );
            when(messageRepository.findById(testMessageId)).thenReturn(Optional.of(existing));
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(testStopId));
            when(messageRepository.save(any(BroadcastMessage.class))).thenReturn(existing);

            MessageResponse result = messageService.updateMessage(testMessageId, request);

            verify(messageRepository).save(any(BroadcastMessage.class));
            verify(eventPublisher).publishEvent(any(MessageChangedEvent.class));
        }

        @Test
        @DisplayName("throws EntityNotFoundException when message not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            CreateMessageRequest request = new CreateMessageRequest(
                    "Title", "Content", MessageSeverity.INFO, now, futureTime, MessageScope.NETWORK, null
            );
            when(messageRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> messageService.updateMessage(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class);
        }
    }

    @Nested
    @DisplayName("deleteMessage")
    class DeleteMessage {

        @Test
        @DisplayName("deletes message and publishes event")
        void deletesAndPublishesEvent() {
            BroadcastMessage existing = TestDataFactory.createNetworkMessage();
            existing.setId(testMessageId);
            when(messageRepository.findById(testMessageId)).thenReturn(Optional.of(existing));
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(testStopId));

            messageService.deleteMessage(testMessageId);

            verify(messageRepository).delete(existing);
            verify(eventPublisher).publishEvent(any(MessageChangedEvent.class));
        }

        @Test
        @DisplayName("throws EntityNotFoundException when message not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(messageRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> messageService.deleteMessage(unknownId))
                    .isInstanceOf(EntityNotFoundException.class);

            verify(messageRepository, never()).delete(any(BroadcastMessage.class));
        }

        @Test
        @DisplayName("publishes event with correct affected stops for LINE message")
        void publishesEventWithCorrectAffectedStopsForLineMessage() {
            UUID stop2Id = UUID.randomUUID();
            Stop stop2 = TestDataFactory.createStopWithId(stop2Id, "Other Station", testLine);
            BroadcastMessage lineMessage = TestDataFactory.createLineMessage(testLineId);
            lineMessage.setId(testMessageId);

            when(messageRepository.findById(testMessageId)).thenReturn(Optional.of(lineMessage));
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of(testStop, stop2));

            messageService.deleteMessage(testMessageId);

            ArgumentCaptor<MessageChangedEvent> eventCaptor = ArgumentCaptor.forClass(MessageChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getAffectedStopIds()).containsExactlyInAnyOrder(testStopId, stop2Id);
        }

        @Test
        @DisplayName("publishes event with correct affected stop for STOP message")
        void publishesEventWithCorrectAffectedStopForStopMessage() {
            BroadcastMessage stopMessage = TestDataFactory.createStopMessage(testStopId);
            stopMessage.setId(testMessageId);

            when(messageRepository.findById(testMessageId)).thenReturn(Optional.of(stopMessage));

            messageService.deleteMessage(testMessageId);

            ArgumentCaptor<MessageChangedEvent> eventCaptor = ArgumentCaptor.forClass(MessageChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getAffectedStopIds()).containsExactly(testStopId);
        }
    }

    @Nested
    @DisplayName("createMessage - LINE scope with no stops")
    class CreateMessageLineScopeNoStops {

        @Test
        @DisplayName("does not publish event when LINE has no stops")
        void lineScopeWithNoStops_DoesNotPublishEvent() {
            CreateMessageRequest request = new CreateMessageRequest(
                    "Line Alert",
                    "Line-specific message",
                    MessageSeverity.WARNING,
                    now.minus(1, ChronoUnit.HOURS),
                    now.plus(1, ChronoUnit.HOURS),
                    MessageScope.LINE,
                    testLineId
            );
            when(lineRepository.existsById(testLineId)).thenReturn(true);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of());
            when(messageRepository.save(any(BroadcastMessage.class))).thenAnswer(invocation -> {
                BroadcastMessage saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            messageService.createMessage(request);

            verify(eventPublisher, never()).publishEvent(any(MessageChangedEvent.class));
        }
    }

    @Nested
    @DisplayName("updateMessage - scope change")
    class UpdateMessageScopeChange {

        @Test
        @DisplayName("publishes event with both old and new affected stops when scope changes from LINE to NETWORK")
        void scopeChangeFromLineToNetwork_PublishesAllAffectedStops() {
            UUID stop2Id = UUID.randomUUID();
            UUID stop3Id = UUID.randomUUID();
            Stop stop2 = TestDataFactory.createStopWithId(stop2Id, "Line Stop", testLine);

            // Existing message is LINE-scoped
            BroadcastMessage existing = TestDataFactory.createLineMessage(testLineId);
            existing.setId(testMessageId);

            // Update to NETWORK scope
            CreateMessageRequest request = new CreateMessageRequest(
                    "Updated Title",
                    "Updated content",
                    MessageSeverity.WARNING,
                    now,
                    futureTime,
                    MessageScope.NETWORK,
                    null
            );

            when(messageRepository.findById(testMessageId)).thenReturn(Optional.of(existing));
            // Original affected stops (LINE scope)
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of(testStop, stop2));
            // New affected stops (NETWORK scope) - includes stop3 that was not in original
            when(activeDisplayTracker.getActiveStopIds()).thenReturn(Set.of(testStopId, stop2Id, stop3Id));
            when(messageRepository.save(any(BroadcastMessage.class))).thenReturn(existing);

            messageService.updateMessage(testMessageId, request);

            ArgumentCaptor<MessageChangedEvent> eventCaptor = ArgumentCaptor.forClass(MessageChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            Set<UUID> affectedStops = eventCaptor.getValue().getAffectedStopIds();
            assertThat(affectedStops).containsExactlyInAnyOrder(testStopId, stop2Id, stop3Id);
        }
    }

    @Nested
    @DisplayName("getAllMessages - paginated with filters")
    class GetAllMessagesPaginated {

        // All filter combinations now route through the single
        // JpaSpecificationExecutor.findAll(Specification, Pageable) entry point.
        // The tests verify that the correct overload is called for every
        // filter combination and that special inputs (blank search, false active)
        // are treated as absent filters.

        @SuppressWarnings("unchecked")
        private Page<BroadcastMessage> stubSpec(Pageable pageable, Page<BroadcastMessage> page) {
            when(messageRepository.findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable)))
                    .thenReturn(page);
            return page;
        }

        @Test
        @DisplayName("delegates all filter combinations to findAll(Specification, Pageable)")
        void withAllFilters_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            BroadcastMessage msg = TestDataFactory.createNetworkMessage();
            Page<BroadcastMessage> page = new PageImpl<>(List.of(msg), pageable, 1);
            stubSpec(pageable, page);

            messageService.getAllMessages(true, MessageSeverity.WARNING, "alert", pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("delegates active+severity combination to findAll(Specification, Pageable)")
        void withActiveAndSeverity_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(true, MessageSeverity.CRITICAL, null, pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("delegates active+search combination to findAll(Specification, Pageable)")
        void withActiveAndSearch_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(true, null, "test", pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("delegates active-only filter to findAll(Specification, Pageable)")
        void withActiveOnly_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(true, null, null, pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("delegates severity+search combination to findAll(Specification, Pageable)")
        void withSeverityAndSearch_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(null, MessageSeverity.INFO, "notice", pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("delegates severity-only filter to findAll(Specification, Pageable)")
        void withSeverityOnly_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(null, MessageSeverity.INFO, null, pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("delegates search-only filter to findAll(Specification, Pageable)")
        void withSearchOnly_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(null, null, "alert", pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("delegates no-filter call to findAll(Specification, Pageable)")
        void withNoFilters_DelegatesToSpecification() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(null, null, null, pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("treats blank search as no search filter")
        void withBlankSearch_TreatsAsNoSearch() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(null, null, "   ", pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }

        @Test
        @DisplayName("treats false active flag as no active filter")
        void withFalseActive_TreatsAsNoFilter() {
            Pageable pageable = PageRequest.of(0, 10);
            Page<BroadcastMessage> page = new PageImpl<>(List.of(), pageable, 0);
            stubSpec(pageable, page);

            messageService.getAllMessages(false, null, null, pageable);

            verify(messageRepository).findAll(any(org.springframework.data.jpa.domain.Specification.class), eq(pageable));
        }
    }
}
