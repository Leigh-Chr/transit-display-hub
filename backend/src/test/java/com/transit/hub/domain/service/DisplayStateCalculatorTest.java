package com.transit.hub.domain.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.TimedEntry;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TimedEntryRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Instant;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DisplayStateCalculator")
class DisplayStateCalculatorTest {

    @Mock
    private StopRepository stopRepository;

    @Mock
    private TimedEntryRepository timedEntryRepository;

    @Mock
    private BroadcastMessageRepository messageRepository;

    @InjectMocks
    private DisplayStateCalculator calculator;

    private Line testLine;
    private Stop testStop;
    private UUID testLineId;
    private UUID testStopId;

    @BeforeEach
    void setUp() {
        testLineId = UUID.randomUUID();
        testStopId = UUID.randomUUID();
        testLine = TestDataFactory.createLineWithId(testLineId, "L1", "Metro Line 1", "#FF5733");
        testStop = TestDataFactory.createStopWithId(testStopId, "Central Station", testLine);
    }

    @Nested
    @DisplayName("calculateForStop")
    class CalculateForStop {

        @Test
        @DisplayName("returns display state with stop and lines info")
        void returnsDisplayStateWithStopInfo() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.stopId()).isEqualTo(testStopId);
            assertThat(result.stopName()).isEqualTo("Central Station");
            assertThat(result.lines()).hasSize(1);
            assertThat(result.lines().get(0).code()).isEqualTo("L1");
            assertThat(result.lines().get(0).name()).isEqualTo("Metro Line 1");
            assertThat(result.lines().get(0).color()).isEqualTo("#FF5733");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(stopRepository.findByIdWithLines(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> calculator.calculateForStop(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }

        @Test
        @DisplayName("includes version number that increments")
        void includesIncrementingVersion() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result1 = calculator.calculateForStop(testStopId);
            DisplayState result2 = calculator.calculateForStop(testStopId);

            assertThat(result1.version()).isGreaterThan(0);
            assertThat(result2.version()).isEqualTo(result1.version() + 1);
        }

        @Test
        @DisplayName("includes timestamp")
        void includesTimestamp() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            Instant before = Instant.now();
            DisplayState result = calculator.calculateForStop(testStopId);
            Instant after = Instant.now();

            assertThat(result.generatedAt()).isBetween(before, after);
        }
    }

    @Nested
    @DisplayName("Arrivals filtering")
    class ArrivalsFiltering {

        @Test
        @DisplayName("filters out past arrivals")
        void filtersPassedArrivals() {
            // Only future arrivals should be returned
            TimedEntry futureEntry = TestDataFactory.createTimedEntry(LocalTime.now().plusHours(1), testStop, testLine);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of(futureEntry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
        }

        @Test
        @DisplayName("limits to five arrivals maximum")
        void limitsToFiveArrivals() {
            // Create more than 5 entries
            List<TimedEntry> manyEntries = List.of(
                    TestDataFactory.createTimedEntry(LocalTime.of(8, 0), testStop, testLine),
                    TestDataFactory.createTimedEntry(LocalTime.of(8, 15), testStop, testLine),
                    TestDataFactory.createTimedEntry(LocalTime.of(8, 30), testStop, testLine),
                    TestDataFactory.createTimedEntry(LocalTime.of(8, 45), testStop, testLine),
                    TestDataFactory.createTimedEntry(LocalTime.of(9, 0), testStop, testLine),
                    TestDataFactory.createTimedEntry(LocalTime.of(9, 15), testStop, testLine),
                    TestDataFactory.createTimedEntry(LocalTime.of(9, 30), testStop, testLine)
            );

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(manyEntries);
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(5);
        }

        @Test
        @DisplayName("returns empty list when no upcoming arrivals")
        void returnsEmptyWhenNoArrivals() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).isEmpty();
        }

        @Test
        @DisplayName("includes arrival time in response")
        void includesArrivalTime() {
            LocalTime arrivalTime = LocalTime.of(14, 30);
            TimedEntry entry = TestDataFactory.createTimedEntry(arrivalTime, testStop, testLine);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of(entry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.arrivals().get(0).scheduledTime()).isEqualTo(arrivalTime);
        }

        @Test
        @DisplayName("includes line info in each arrival")
        void includesLineInfoInArrivals() {
            TimedEntry entry = TestDataFactory.createTimedEntry(LocalTime.of(14, 30), testStop, testLine);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of(entry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            DisplayState.ArrivalInfo arrival = result.arrivals().get(0);
            assertThat(arrival.line().code()).isEqualTo("L1");
            assertThat(arrival.line().name()).isEqualTo("Metro Line 1");
        }
    }

    @Nested
    @DisplayName("Messages filtering")
    class MessagesFiltering {

        @Test
        @DisplayName("includes active messages")
        void includesActiveMessages() {
            BroadcastMessage activeMessage = TestDataFactory.createNetworkMessage();

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(activeMessage));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).hasSize(1);
            assertThat(result.messages().get(0).title()).isEqualTo("Test Alert");
        }

        @Test
        @DisplayName("includes NETWORK scope messages")
        void includesNetworkScopeMessages() {
            BroadcastMessage networkMessage = TestDataFactory.createNetworkMessage();

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(networkMessage));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).isNotEmpty();
        }

        @Test
        @DisplayName("includes LINE scope messages")
        void includesLineScopeMessages() {
            BroadcastMessage lineMessage = TestDataFactory.createLineMessage(testLineId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(lineMessage));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).isNotEmpty();
        }

        @Test
        @DisplayName("includes STOP scope messages")
        void includesStopScopeMessages() {
            BroadcastMessage stopMessage = TestDataFactory.createStopMessage(testStopId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(stopMessage));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).isNotEmpty();
        }

        @Test
        @DisplayName("limits to three messages maximum")
        void limitsToThreeMessages() {
            List<BroadcastMessage> manyMessages = List.of(
                    TestDataFactory.createNetworkMessage(),
                    TestDataFactory.createNetworkMessage(),
                    TestDataFactory.createNetworkMessage(),
                    TestDataFactory.createNetworkMessage(),
                    TestDataFactory.createNetworkMessage()
            );

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(manyMessages);

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).hasSize(3);
        }

        @Test
        @DisplayName("returns empty list when no active messages")
        void returnsEmptyWhenNoMessages() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).isEmpty();
        }

        @Test
        @DisplayName("includes message severity in response")
        void includesMessageSeverity() {
            BroadcastMessage criticalMessage = TestDataFactory.createCriticalMessage(MessageScope.NETWORK, null);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(criticalMessage));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).hasSize(1);
            assertThat(result.messages().get(0).severity()).isEqualTo(MessageSeverity.CRITICAL);
        }

        @Test
        @DisplayName("includes message title and content")
        void includesMessageTitleAndContent() {
            BroadcastMessage message = TestDataFactory.createNetworkMessage();
            message.setTitle("Important Notice");
            message.setContent("Service disruption expected");

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(message));

            DisplayState result = calculator.calculateForStop(testStopId);

            DisplayState.MessageInfo messageInfo = result.messages().get(0);
            assertThat(messageInfo.title()).isEqualTo("Important Notice");
            assertThat(messageInfo.content()).isEqualTo("Service disruption expected");
        }
    }

    @Nested
    @DisplayName("Combined state")
    class CombinedState {

        @Test
        @DisplayName("includes both arrivals and messages")
        void includesBothArrivalsAndMessages() {
            TimedEntry entry = TestDataFactory.createTimedEntry(LocalTime.of(14, 30), testStop, testLine);
            BroadcastMessage message = TestDataFactory.createNetworkMessage();

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.findByStopIdAndTimeAfterWithLine(eq(testStopId), any(LocalTime.class)))
                    .thenReturn(List.of(entry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(message));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.messages()).hasSize(1);
        }
    }
}
