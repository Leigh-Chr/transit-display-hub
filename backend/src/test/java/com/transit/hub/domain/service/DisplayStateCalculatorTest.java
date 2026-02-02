package com.transit.hub.domain.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
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
    private ScheduleRepository scheduleRepository;

    @Mock
    private BroadcastMessageRepository messageRepository;

    @InjectMocks
    private DisplayStateCalculator calculator;

    private Line testLine;
    private Itinerary testItinerary;
    private Stop testStop;
    private UUID testLineId;
    private UUID testItineraryId;
    private UUID testStopId;

    @BeforeEach
    void setUp() {
        testLineId = UUID.randomUUID();
        testStopId = UUID.randomUUID();
        testItineraryId = UUID.randomUUID();
        testLine = TestDataFactory.createLineWithId(testLineId, "L1", "Metro Line 1", "#FF5733");
        testItinerary = TestDataFactory.createItineraryWithId(testItineraryId, testLine, "Direction Eastern");
        testStop = TestDataFactory.createStopWithId(testStopId, "Central Station", testLine);
    }

    @Nested
    @DisplayName("calculateForStop")
    class CalculateForStop {

        @Test
        @DisplayName("returns display state with stop and lines info")
        void returnsDisplayStateWithStopInfo() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            Schedule futureEntry = TestDataFactory.createSchedule(LocalTime.now().plusHours(1), testStop, testItinerary);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(futureEntry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
        }

        @Test
        @DisplayName("returns one arrival per line only")
        void returnsOneArrivalPerLine() {
            // Create multiple entries for the same line - only the first should be returned
            List<Schedule> multipleEntriesSameLine = List.of(
                    TestDataFactory.createSchedule(LocalTime.of(8, 0), testStop, testItinerary),
                    TestDataFactory.createSchedule(LocalTime.of(8, 15), testStop, testItinerary),
                    TestDataFactory.createSchedule(LocalTime.of(8, 30), testStop, testItinerary)
            );

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(multipleEntriesSameLine);
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            // Only one arrival per line (the earliest)
            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.arrivals().get(0).scheduledTime()).isEqualTo(LocalTime.of(8, 0));
        }

        @Test
        @DisplayName("returns multiple arrivals for different lines")
        void returnsMultipleArrivalsForDifferentLines() {
            // Create entries for different lines
            Line line2 = TestDataFactory.createLineWithId(UUID.randomUUID(), "L2", "Metro Line 2", "#33FF57");
            Itinerary itinerary2 = TestDataFactory.createItineraryWithId(UUID.randomUUID(), line2, "Direction West");

            List<Schedule> entriesFromDifferentLines = List.of(
                    TestDataFactory.createSchedule(LocalTime.of(8, 0), testStop, testItinerary),
                    TestDataFactory.createSchedule(LocalTime.of(8, 10), testStop, itinerary2),
                    TestDataFactory.createSchedule(LocalTime.of(8, 15), testStop, testItinerary), // Should be ignored (same line as first)
                    TestDataFactory.createSchedule(LocalTime.of(8, 20), testStop, itinerary2)     // Should be ignored (same line as second)
            );

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(entriesFromDifferentLines);
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            // Two arrivals: one for L1 (8:00), one for L2 (8:10)
            assertThat(result.arrivals()).hasSize(2);
            assertThat(result.arrivals().get(0).scheduledTime()).isEqualTo(LocalTime.of(8, 0));
            assertThat(result.arrivals().get(0).line().code()).isEqualTo("L1");
            assertThat(result.arrivals().get(1).scheduledTime()).isEqualTo(LocalTime.of(8, 10));
            assertThat(result.arrivals().get(1).line().code()).isEqualTo("L2");
        }

        @Test
        @DisplayName("returns empty list when no upcoming arrivals")
        void returnsEmptyWhenNoArrivals() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            Schedule entry = TestDataFactory.createSchedule(arrivalTime, testStop, testItinerary);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            Schedule entry = TestDataFactory.createSchedule(LocalTime.of(14, 30), testStop, testItinerary);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(entry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            DisplayState.ArrivalInfo arrival = result.arrivals().get(0);
            assertThat(arrival.line().code()).isEqualTo("L1");
            assertThat(arrival.line().name()).isEqualTo("Metro Line 1");
        }

        @Test
        @DisplayName("uses itinerary terminus name as destination")
        void usesItineraryTerminusAsDestination() {
            // Create a terminus stop and add it to the itinerary
            Stop terminusStop = TestDataFactory.createStopWithId(UUID.randomUUID(), "Eastern Terminal", testLine);
            testItinerary.addStop(testStop, 0);
            testItinerary.addStop(terminusStop, 1);

            Schedule entry = TestDataFactory.createSchedule(LocalTime.of(14, 30), testStop, testItinerary);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(entry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            DisplayState.ArrivalInfo arrival = result.arrivals().get(0);
            assertThat(arrival.destinationName()).isEqualTo("Eastern Terminal");
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
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
            Schedule entry = TestDataFactory.createSchedule(LocalTime.of(14, 30), testStop, testItinerary);
            BroadcastMessage message = TestDataFactory.createNetworkMessage();

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(entry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(message));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.messages()).hasSize(1);
        }
    }
}
