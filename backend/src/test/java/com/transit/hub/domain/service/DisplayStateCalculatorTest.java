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
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
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

    @Mock
    private ServiceCalendarRepository serviceCalendarRepository;

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
        // Default to "no calendars persisted" — schedules with a null FK
        // (the test fixtures) are treated as always-active by the matcher,
        // which keeps the existing test expectations intact. lenient() so
        // the strict-mockito mode doesn't complain about tests that bail
        // out before the calculator reaches the calendar lookup (e.g. the
        // "stop not found" path).
        lenient().when(serviceCalendarRepository.findAllWithExceptions())
                .thenReturn(List.of());
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
        @DisplayName("returns one arrival per itinerary only")
        void returnsOneArrivalPerItinerary() {
            // Create multiple entries for the same itinerary - only the first should be returned
            List<Schedule> multipleEntriesSameItinerary = List.of(
                    TestDataFactory.createSchedule(LocalTime.of(8, 0), testStop, testItinerary),
                    TestDataFactory.createSchedule(LocalTime.of(8, 15), testStop, testItinerary),
                    TestDataFactory.createSchedule(LocalTime.of(8, 30), testStop, testItinerary)
            );

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(multipleEntriesSameItinerary);
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            // Only one arrival per itinerary (the earliest)
            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.arrivals().get(0).scheduledTime()).isEqualTo(LocalTime.of(8, 0));
        }

        @Test
        @DisplayName("returns both directions for the same line")
        void returnsBothDirectionsForSameLine() {
            // Two itineraries for the same line (e.g. eastbound and westbound)
            Itinerary eastbound = TestDataFactory.createItineraryWithId(UUID.randomUUID(), testLine, "Direction East");
            Stop eastTerminus = TestDataFactory.createStopWithId(UUID.randomUUID(), "Eastern Terminal", testLine);
            eastbound.addStop(testStop, 0);
            eastbound.addStop(eastTerminus, 1);

            Itinerary westbound = TestDataFactory.createItineraryWithId(UUID.randomUUID(), testLine, "Direction West");
            Stop westTerminus = TestDataFactory.createStopWithId(UUID.randomUUID(), "Western Terminal", testLine);
            westbound.addStop(testStop, 0);
            westbound.addStop(westTerminus, 1);

            List<Schedule> bothDirections = List.of(
                    TestDataFactory.createSchedule(LocalTime.of(8, 0), testStop, eastbound),
                    TestDataFactory.createSchedule(LocalTime.of(8, 5), testStop, westbound)
            );

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(bothDirections);
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            // Both directions should be shown (one arrival per itinerary)
            assertThat(result.arrivals()).hasSize(2);
            assertThat(result.arrivals().get(0).scheduledTime()).isEqualTo(LocalTime.of(8, 0));
            assertThat(result.arrivals().get(0).destinationName()).isEqualTo("Eastern Terminal");
            assertThat(result.arrivals().get(0).line().code()).isEqualTo("L1");
            assertThat(result.arrivals().get(1).scheduledTime()).isEqualTo(LocalTime.of(8, 5));
            assertThat(result.arrivals().get(1).destinationName()).isEqualTo("Western Terminal");
            assertThat(result.arrivals().get(1).line().code()).isEqualTo("L1");
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
                    TestDataFactory.createSchedule(LocalTime.of(8, 15), testStop, testItinerary), // Should be ignored (same itinerary as first)
                    TestDataFactory.createSchedule(LocalTime.of(8, 20), testStop, itinerary2)     // Should be ignored (same itinerary as second)
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

    @Nested
    @DisplayName("Version tracking")
    class VersionTracking {

        @Test
        @DisplayName("version increments across multiple calls for the same stop")
        void versionIncrementsAcrossMultipleCalls() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result1 = calculator.calculateForStop(testStopId);
            DisplayState result2 = calculator.calculateForStop(testStopId);
            DisplayState result3 = calculator.calculateForStop(testStopId);

            assertThat(result1.version()).isGreaterThan(0);
            assertThat(result2.version()).isEqualTo(result1.version() + 1);
            assertThat(result3.version()).isEqualTo(result2.version() + 1);
        }

        @Test
        @DisplayName("different stops have independent version counters")
        void differentStopsHaveIndependentVersions() {
            UUID otherStopId = UUID.randomUUID();
            UUID otherLineId = UUID.randomUUID();
            Line otherLine = TestDataFactory.createLineWithId(otherLineId, "L2", "Metro Line 2", "#33FF57");
            Stop otherStop = TestDataFactory.createStopWithId(otherStopId, "Other Station", otherLine);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            when(stopRepository.findByIdWithLines(otherStopId)).thenReturn(Optional.of(otherStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(otherStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(otherLineId)), eq(otherStopId)))
                    .thenReturn(List.of());

            // Call testStop 3 times
            calculator.calculateForStop(testStopId);
            calculator.calculateForStop(testStopId);
            calculator.calculateForStop(testStopId);

            // First call for otherStop should start at version 1
            DisplayState otherResult = calculator.calculateForStop(otherStopId);
            assertThat(otherResult.version()).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("Message limit enforcement")
    class MessageLimitEnforcement {

        @Test
        @DisplayName("returns exactly 3 messages when 4 are available")
        void returnsExactlyThreeWhenFourAvailable() {
            BroadcastMessage msg1 = TestDataFactory.createNetworkMessage();
            msg1.setTitle("Message 1");
            BroadcastMessage msg2 = TestDataFactory.createNetworkMessage();
            msg2.setTitle("Message 2");
            BroadcastMessage msg3 = TestDataFactory.createNetworkMessage();
            msg3.setTitle("Message 3");
            BroadcastMessage msg4 = TestDataFactory.createNetworkMessage();
            msg4.setTitle("Message 4");

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(msg1, msg2, msg3, msg4));

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).hasSize(3);
            assertThat(result.messages()).extracting(DisplayState.MessageInfo::title)
                    .containsExactly("Message 1", "Message 2", "Message 3");
        }
    }

    @Nested
    @DisplayName("Empty itinerary handling")
    class EmptyItineraryHandling {

        @Test
        @DisplayName("returns null destination when itinerary has no stops")
        void returnsNullDestinationWhenItineraryHasNoStops() {
            // testItinerary has no stops added, so getTerminusName() returns null
            Schedule entry = TestDataFactory.createSchedule(LocalTime.of(14, 30), testStop, testItinerary);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(entry));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.arrivals().get(0).destinationName()).isNull();
        }
    }

    @Nested
    @DisplayName("Duplicate schedule times")
    class DuplicateScheduleTimes {

        @Test
        @DisplayName("keeps only first entry when same itinerary has duplicate times")
        void keepsFirstEntryForDuplicateTimesOnSameItinerary() {
            Schedule entry1 = TestDataFactory.createSchedule(LocalTime.of(10, 0), testStop, testItinerary);
            Schedule entry2 = TestDataFactory.createSchedule(LocalTime.of(10, 0), testStop, testItinerary);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(entry1, entry2));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            // Only one arrival per itinerary (deduplication by itinerary ID)
            assertThat(result.arrivals()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("All messages filtered out")
    class AllMessagesFilteredOut {

        @Test
        @DisplayName("returns empty messages list when repository returns no active messages")
        void returnsEmptyMessagesWhenNoneActive() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.messages()).isEmpty();
            assertThat(result.arrivals()).isEmpty();
            assertThat(result.stopId()).isEqualTo(testStopId);
            assertThat(result.stopName()).isEqualTo("Central Station");
        }
    }
}
