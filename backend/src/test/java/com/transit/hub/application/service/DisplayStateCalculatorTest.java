package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import com.transit.hub.infrastructure.realtime.RealtimeTripUpdateCache;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.argThat;
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
    private ServiceCalendarCache serviceCalendarCache;

    @Mock
    private TranslationRepository translationRepository;

    @Mock
    private RealtimeAlertCache realtimeAlertCache;

    @Mock
    private RealtimeTripUpdateCache realtimeTripUpdateCache;

    private RealtimeAlertMatcher realtimeAlertMatcher;

    /** Pin "now" mid-day so the calculator's 30-minute window never
     *  crosses midnight. The DSC tests stub the in-window query
     *  variant, so a wall-clock-driven now() near 23:30 would silently
     *  reroute the calculator to the cross-midnight branch and trip
     *  Mockito's strict-stubbing audit. */
    private static final Instant FIXED_NOW =
            Instant.parse("2026-01-15T10:00:00Z");
    private final Clock clock = Clock.fixed(FIXED_NOW, ZoneId.of("Europe/Paris"));

    private DisplayStateCalculator calculator;

    private Line testLine;
    private Itinerary testItinerary;
    private Stop testStop;
    private UUID testLineId;
    private UUID testItineraryId;
    private UUID testStopId;

    @BeforeEach
    void setUp() {
        // Manual construction so we can pass a fixed Clock alongside
        // the Mockito mocks. @InjectMocks doesn't pick up plain
        // (non-@Mock) fields like our Clock.fixed instance.
        // RealtimeAlertMatcher is the small collaborator extracted in
        // v1.18.0; wrap the cache mock the existing tests already stub
        // so the alert-matching flow keeps working through the bridge.
        realtimeAlertMatcher = new RealtimeAlertMatcher(realtimeAlertCache);
        // ArrivalEnricher is the schedule-to-DTO extraction landed
        // post-v1.19; it owns the realtime trip-update lookups now, but
        // the calculator test still stubs realtimeTripUpdateCache so the
        // delay / skip paths exercised below keep going through the same
        // Mockito mock — just one hop deeper.
        com.transit.hub.application.service.ArrivalEnricher arrivalEnricher =
                new com.transit.hub.application.service.ArrivalEnricher(realtimeTripUpdateCache);
        calculator = new DisplayStateCalculator(
                stopRepository,
                scheduleRepository,
                messageRepository,
                serviceCalendarCache,
                translationRepository,
                arrivalEnricher,
                realtimeAlertMatcher,
                clock
        );
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
        lenient().when(serviceCalendarCache.loadAll())
                .thenReturn(java.util.Map.of());
        // Default to "no realtime alerts" — keeps the existing message
        // assertions stable while the new MAX_MESSAGES path still picks
        // up an empty list cleanly.
        lenient().when(realtimeAlertCache.activeAlerts(any(Instant.class)))
                .thenReturn(List.of());
        // Default to "no trip updates" — schedules render with their
        // theoretical times, no delay applied. Tests that exercise
        // the realtime path can override per-trip with their own
        // when(...).
        lenient().when(realtimeTripUpdateCache.findUpdate(org.mockito.ArgumentMatchers.anyString()))
                .thenReturn(java.util.Optional.empty());
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

            DisplayState result = calculator.calculateForStop(testStopId);

            // The calculator reads its own clock (fixed in this test
            // class), so the generated timestamp is exactly the pinned
            // instant — not "between two reads of Instant.now()" like
            // the original wall-clock-driven assertion.
            assertThat(result.generatedAt()).isEqualTo(FIXED_NOW);
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
            eastbound.addItineraryStop(ItineraryStop.builder().stop(testStop).position(0).build());
            eastbound.addItineraryStop(ItineraryStop.builder().stop(eastTerminus).position(1).build());

            Itinerary westbound = TestDataFactory.createItineraryWithId(UUID.randomUUID(), testLine, "Direction West");
            Stop westTerminus = TestDataFactory.createStopWithId(UUID.randomUUID(), "Western Terminal", testLine);
            westbound.addItineraryStop(ItineraryStop.builder().stop(testStop).position(0).build());
            westbound.addItineraryStop(ItineraryStop.builder().stop(westTerminus).position(1).build());

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
            testItinerary.addItineraryStop(ItineraryStop.builder().stop(testStop).position(0).build());
            testItinerary.addItineraryStop(ItineraryStop.builder().stop(terminusStop).position(1).build());

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
        @DisplayName("surfaces whatever findActiveMessagesForStop returns — scope filtering is the repo's job")
        void surfacesWhateverTheRepoReturns() {
            // The previous four tests (NETWORK / LINE / STOP / "active") each
            // mocked the repo to return a hard-coded list and then verified
            // that result.messages() was non-empty — they were re-testing the
            // pass-through, not any scope logic (which lives in the JPQL of
            // findActiveMessagesForStop). One mixed-scope test covers the same
            // surface; the actual scope-aware predicate is exercised against a
            // real DB by BroadcastMessageRepositoryTest.findActiveMessagesForStop.
            BroadcastMessage networkMsg = TestDataFactory.createNetworkMessage();
            BroadcastMessage lineMsg = TestDataFactory.createLineMessage(testLineId);
            BroadcastMessage stopMsg = TestDataFactory.createStopMessage(testStopId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId), any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class), eq(Set.of(testLineId)), eq(testStopId)))
                    .thenReturn(List.of(networkMsg, lineMsg, stopMsg));

            DisplayState result = calculator.calculateForStop(testStopId);

            // All three flow through untouched (max cap is verified separately).
            assertThat(result.messages()).hasSize(3);
            assertThat(result.messages().get(0).title()).isEqualTo("Test Alert");
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

    @Nested
    @DisplayName("Phase 1.3 — parent station aggregation")
    class ParentStationAggregation {

        @Test
        @DisplayName("regular platform stop uses single-id query, no children fan-out")
        void platformStopUsesSingleIdQuery() {
            // location_type = 0 (platform): the calculator stays on the
            // single-id fast path and never touches findChildIds.
            testStop.setLocationType((short) 0);
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId),
                    any(LocalTime.class), any(LocalTime.class))).thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class),
                    eq(Set.of(testLineId)), eq(testStopId))).thenReturn(List.of());

            calculator.calculateForStop(testStopId);

            verify(stopRepository, never()).findChildIds(any(UUID.class));
            verify(scheduleRepository, never()).findByStopIdsAndTimeWindowWithItinerary(
                    any(), any(LocalTime.class), any(LocalTime.class));
        }

        @Test
        @DisplayName("parent station expands to children and uses IN-based query")
        void parentStationExpandsToChildren() {
            UUID childA = UUID.randomUUID();
            UUID childB = UUID.randomUUID();
            testStop.setLocationType((short) 1);
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(stopRepository.findChildIds(testStopId)).thenReturn(List.of(childA, childB));
            // The calculator now runs on a {parent, childA, childB} set,
            // so it picks the IN-based query rather than the single-id
            // one. Empty result is fine — we're verifying routing.
            when(scheduleRepository.findByStopIdsAndTimeWindowWithItinerary(any(),
                    any(LocalTime.class), any(LocalTime.class))).thenReturn(List.of());
            when(messageRepository.findActiveMessagesForStop(any(Instant.class),
                    eq(Set.of(testLineId)), eq(testStopId))).thenReturn(List.of());

            calculator.calculateForStop(testStopId);

            verify(stopRepository).findChildIds(testStopId);
            verify(scheduleRepository).findByStopIdsAndTimeWindowWithItinerary(
                    argThat(ids -> ids.size() == 3
                            && ids.contains(testStopId)
                            && ids.contains(childA)
                            && ids.contains(childB)),
                    any(LocalTime.class), any(LocalTime.class));
            verify(scheduleRepository, never()).findByStopIdAndTimeWindowWithItinerary(
                    any(UUID.class), any(LocalTime.class), any(LocalTime.class));
        }

        @Test
        @DisplayName("per-arrival platformCode comes from the schedule's actual stop")
        void perArrivalPlatformCodeFromScheduleStop() {
            // A parent station kiosk receives schedules from two different
            // platforms; each arrival's platformCode must match the
            // platform it came from, not the parent's (empty) one.
            // Different itineraries are required because the calculator
            // groups arrivals by itinerary id (one earliest per direction).
            testStop.setLocationType((short) 1);
            testStop.setPlatformCode(null);

            Stop platformA = TestDataFactory.createStop("Platform A", testLine);
            platformA.setPlatformCode("A");
            Stop platformB = TestDataFactory.createStop("Platform B", testLine);
            platformB.setPlatformCode("B");

            Itinerary itinNorth = TestDataFactory.createItinerary(testLine, "North");
            Itinerary itinSouth = TestDataFactory.createItinerary(testLine, "South");

            Schedule schedA = TestDataFactory.createSchedule(LocalTime.of(8, 30), platformA, itinNorth);
            Schedule schedB = TestDataFactory.createSchedule(LocalTime.of(8, 35), platformB, itinSouth);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(stopRepository.findChildIds(testStopId)).thenReturn(List.of(platformA.getId(), platformB.getId()));
            when(scheduleRepository.findByStopIdsAndTimeWindowWithItinerary(any(),
                    any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(schedA, schedB));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class),
                    any(), eq(testStopId))).thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(2);
            assertThat(result.arrivals())
                    .extracting(DisplayState.ArrivalInfo::platformCode)
                    .containsExactlyInAnyOrder("A", "B");
        }
    }

    @Nested
    @DisplayName("Phase TAD — booking info on on-demand arrivals")
    class TadBookingInfo {

        @Test
        @DisplayName("regular pickup_type=0 yields no booking info even with rule attached")
        void regularPickupNoBookingSurface() {
            // GTFS allows (rare) booking_rule attached to a regular
            // pickup_type=0 trip. The kiosk should not render a CTA in
            // that case — only on-demand pickups (2/3) trigger the
            // surface.
            com.transit.hub.domain.model.BookingRule rule = com.transit.hub.domain.model.BookingRule.builder()
                    .bookingType(com.transit.hub.domain.model.enums.BookingType.PRIOR_DAYS)
                    .phone("0123456789")
                    .priorNoticeDurationMin(30)
                    .build();
            Schedule sched = Schedule.builder()
                    .id(UUID.randomUUID())
                    .time(LocalTime.of(9, 0))
                    .stop(testStop)
                    .itinerary(testItinerary)
                    .pickupType((short) 0)
                    .pickupBookingRule(rule)
                    .build();

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId),
                    any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(sched));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class),
                    eq(Set.of(testLineId)), eq(testStopId))).thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.arrivals().get(0).booking()).isNull();
        }

        @Test
        @DisplayName("on-request pickup with booking rule surfaces phone and prior notice")
        void onRequestPickupSurfacesBooking() {
            com.transit.hub.domain.model.BookingRule rule = com.transit.hub.domain.model.BookingRule.builder()
                    .bookingType(com.transit.hub.domain.model.enums.BookingType.PRIOR_DAYS)
                    .phone("0123456789")
                    .bookingUrl("https://example.com/book")
                    .priorNoticeDurationMin(45)
                    .build();
            Schedule sched = Schedule.builder()
                    .id(UUID.randomUUID())
                    .time(LocalTime.of(9, 0))
                    .stop(testStop)
                    .itinerary(testItinerary)
                    // pickup_type=2: on-request to the agency
                    .pickupType((short) 2)
                    .pickupBookingRule(rule)
                    .build();

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId),
                    any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(sched));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class),
                    eq(Set.of(testLineId)), eq(testStopId))).thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
            DisplayState.BookingInfo booking = result.arrivals().get(0).booking();
            assertThat(booking).isNotNull();
            assertThat(booking.phone()).isEqualTo("0123456789");
            assertThat(booking.bookingUrl()).isEqualTo("https://example.com/book");
            assertThat(booking.priorNoticeMinutes()).isEqualTo(45);
        }

        @Test
        @DisplayName("on-request pickup without booking rule yields null booking")
        void onRequestPickupNoRuleYieldsNull() {
            Schedule sched = Schedule.builder()
                    .id(UUID.randomUUID())
                    .time(LocalTime.of(9, 0))
                    .stop(testStop)
                    .itinerary(testItinerary)
                    .pickupType((short) 3)  // on-request to the driver
                    .pickupBookingRule(null)
                    .build();

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(scheduleRepository.findByStopIdAndTimeWindowWithItinerary(eq(testStopId),
                    any(LocalTime.class), any(LocalTime.class)))
                    .thenReturn(List.of(sched));
            when(messageRepository.findActiveMessagesForStop(any(Instant.class),
                    eq(Set.of(testLineId)), eq(testStopId))).thenReturn(List.of());

            DisplayState result = calculator.calculateForStop(testStopId);

            assertThat(result.arrivals()).hasSize(1);
            assertThat(result.arrivals().get(0).booking()).isNull();
        }
    }
}
