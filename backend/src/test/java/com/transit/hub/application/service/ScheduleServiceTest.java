package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateScheduleRequest;
import com.transit.hub.application.dto.response.ScheduleResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.testutil.TestDataFactory;
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
@DisplayName("ScheduleService")
class ScheduleServiceTest {

    @Mock
    private ScheduleRepository scheduleRepository;

    @Mock
    private StopRepository stopRepository;

    @Mock
    private ItineraryRepository itineraryRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private ScheduleService scheduleService;

    private Line testLine;
    private Stop testStop;
    private Itinerary testItinerary;
    private Schedule testSchedule;
    private UUID testLineId;
    private UUID testStopId;
    private UUID testItineraryId;
    private UUID testScheduleId;

    @BeforeEach
    void setUp() {
        testLineId = UUID.randomUUID();
        testStopId = UUID.randomUUID();
        testItineraryId = UUID.randomUUID();
        testScheduleId = UUID.randomUUID();

        testLine = TestDataFactory.createLineWithId(testLineId, "L1", "Metro Line 1", "#FF5733");
        testStop = TestDataFactory.createStopWithId(testStopId, "Central Station", testLine);
        testItinerary = TestDataFactory.createItineraryWithStops(testLine, "Direction East", testStop);
        testItinerary.setId(testItineraryId);

        testSchedule = Schedule.builder()
                .id(testScheduleId)
                .time(LocalTime.of(8, 30))
                .stop(testStop)
                .itinerary(testItinerary)
                .build();
    }

    @Nested
    @DisplayName("getScheduleForStop")
    class GetScheduleForStop {

        @Test
        @DisplayName("returns schedules for a stop")
        void returnsSchedulesForStop() {
            Schedule schedule1 = Schedule.builder()
                    .id(UUID.randomUUID())
                    .time(LocalTime.of(8, 30))
                    .stop(testStop)
                    .itinerary(testItinerary)
                    .build();
            Schedule schedule2 = Schedule.builder()
                    .id(UUID.randomUUID())
                    .time(LocalTime.of(9, 0))
                    .stop(testStop)
                    .itinerary(testItinerary)
                    .build();

            when(stopRepository.existsById(testStopId)).thenReturn(true);
            when(scheduleRepository.findByStopIdWithItineraryOrderByTime(testStopId))
                    .thenReturn(List.of(schedule1, schedule2));

            List<ScheduleResponse> result = scheduleService.getScheduleForStop(testStopId);

            assertThat(result).hasSize(2);
            assertThat(result.get(0).time()).isEqualTo(LocalTime.of(8, 30));
            assertThat(result.get(1).time()).isEqualTo(LocalTime.of(9, 0));
        }

        @Test
        @DisplayName("returns empty list when no schedules exist")
        void returnsEmptyListWhenNoSchedules() {
            when(stopRepository.existsById(testStopId)).thenReturn(true);
            when(scheduleRepository.findByStopIdWithItineraryOrderByTime(testStopId))
                    .thenReturn(List.of());

            List<ScheduleResponse> result = scheduleService.getScheduleForStop(testStopId);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownStopId = UUID.randomUUID();
            when(stopRepository.existsById(unknownStopId)).thenReturn(false);

            assertThatThrownBy(() -> scheduleService.getScheduleForStop(unknownStopId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }
    }

    @Nested
    @DisplayName("createSchedule")
    class CreateSchedule {

        @Test
        @DisplayName("creates a new schedule")
        void createsNewSchedule() {
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", testItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTime(
                    eq(testStopId), eq(testItineraryId), any(LocalTime.class))).thenReturn(false);
            when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> {
                Schedule s = inv.getArgument(0);
                return Schedule.builder()
                        .id(UUID.randomUUID())
                        .time(s.getTime())
                        .stop(s.getStop())
                        .itinerary(s.getItinerary())
                        .build();
            });

            ScheduleResponse result = scheduleService.createSchedule(testStopId, request);

            assertThat(result).isNotNull();
            assertThat(result.time()).isEqualTo(LocalTime.of(10, 0));
            verify(scheduleRepository).save(any(Schedule.class));
        }

        @Test
        @DisplayName("publishes ScheduleChangedEvent after creation")
        void publishesEventAfterCreation() {
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", testItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTime(
                    eq(testStopId), eq(testItineraryId), any(LocalTime.class))).thenReturn(false);
            when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> inv.getArgument(0));

            scheduleService.createSchedule(testStopId, request);

            ArgumentCaptor<ScheduleChangedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getStopId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownStopId = UUID.randomUUID();
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", testItineraryId);

            when(stopRepository.findByIdWithLines(unknownStopId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.createSchedule(unknownStopId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when itinerary not found")
        void throwsWhenItineraryNotFound() {
            UUID unknownItineraryId = UUID.randomUUID();
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", unknownItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(unknownItineraryId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.createSchedule(testStopId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Itinerary");
        }

        @Test
        @DisplayName("throws IllegalArgumentException when itinerary line not associated with stop")
        void throwsWhenLineNotAssociatedWithStop() {
            Line otherLine = TestDataFactory.createLineWithId(UUID.randomUUID(), "L2", "Other Line", "#0000FF");
            Stop otherStop = TestDataFactory.createStopWithId(UUID.randomUUID(), "Other Stop", otherLine);
            Itinerary otherItinerary = TestDataFactory.createItineraryWithStops(otherLine, "Other Direction", otherStop);
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", otherItinerary.getId());

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(otherItinerary.getId())).thenReturn(Optional.of(otherItinerary));

            assertThatThrownBy(() -> scheduleService.createSchedule(testStopId, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not associated with stop");
        }

        @Test
        @DisplayName("throws IllegalArgumentException when itinerary is empty")
        void throwsWhenItineraryEmpty() {
            Itinerary emptyItinerary = TestDataFactory.createItineraryWithId(UUID.randomUUID(), testLine, "Empty");
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", emptyItinerary.getId());

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(emptyItinerary.getId())).thenReturn(Optional.of(emptyItinerary));

            assertThatThrownBy(() -> scheduleService.createSchedule(testStopId, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("has no stops");
        }

        @Test
        @DisplayName("throws IllegalArgumentException when itinerary does not serve the stop")
        void throwsWhenItineraryDoesNotServeStop() {
            Stop neighborStop = TestDataFactory.createStopWithId(UUID.randomUUID(), "Neighbor", testLine);
            Itinerary itineraryNotServingStop = TestDataFactory.createItineraryWithStops(testLine, "Other dir", neighborStop);
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", itineraryNotServingStop.getId());

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(itineraryNotServingStop.getId()))
                    .thenReturn(Optional.of(itineraryNotServingStop));

            assertThatThrownBy(() -> scheduleService.createSchedule(testStopId, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("does not serve stop");
        }

        @Test
        @DisplayName("throws IllegalArgumentException when duplicate schedule exists")
        void throwsWhenDuplicateExists() {
            CreateScheduleRequest request = new CreateScheduleRequest("08:30", testItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTime(
                    testStopId, testItineraryId, LocalTime.of(8, 30))).thenReturn(true);

            assertThatThrownBy(() -> scheduleService.createSchedule(testStopId, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already exists");
        }
    }

    @Nested
    @DisplayName("updateSchedule")
    class UpdateSchedule {

        @Test
        @DisplayName("updates an existing schedule")
        void updatesExistingSchedule() {
            CreateScheduleRequest request = new CreateScheduleRequest("09:00", testItineraryId);

            when(scheduleRepository.findById(testScheduleId)).thenReturn(Optional.of(testSchedule));
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                    eq(testStopId), eq(testItineraryId), any(LocalTime.class), eq(testScheduleId))).thenReturn(false);
            when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> inv.getArgument(0));

            ScheduleResponse result = scheduleService.updateSchedule(testScheduleId, request);

            assertThat(result).isNotNull();
            assertThat(result.time()).isEqualTo(LocalTime.of(9, 0));
            verify(scheduleRepository).save(any(Schedule.class));
        }

        @Test
        @DisplayName("publishes ScheduleChangedEvent after update")
        void publishesEventAfterUpdate() {
            CreateScheduleRequest request = new CreateScheduleRequest("09:00", testItineraryId);

            when(scheduleRepository.findById(testScheduleId)).thenReturn(Optional.of(testSchedule));
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                    eq(testStopId), eq(testItineraryId), any(LocalTime.class), eq(testScheduleId))).thenReturn(false);
            when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> inv.getArgument(0));

            scheduleService.updateSchedule(testScheduleId, request);

            ArgumentCaptor<ScheduleChangedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getStopId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when schedule not found")
        void throwsWhenScheduleNotFound() {
            UUID unknownId = UUID.randomUUID();
            CreateScheduleRequest request = new CreateScheduleRequest("09:00", testItineraryId);

            when(scheduleRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.updateSchedule(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Schedule");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when itinerary not found")
        void throwsWhenItineraryNotFound() {
            UUID unknownItineraryId = UUID.randomUUID();
            CreateScheduleRequest request = new CreateScheduleRequest("09:00", unknownItineraryId);

            when(scheduleRepository.findById(testScheduleId)).thenReturn(Optional.of(testSchedule));
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(unknownItineraryId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.updateSchedule(testScheduleId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Itinerary");
        }

        @Test
        @DisplayName("throws IllegalArgumentException when itinerary line not associated with stop")
        void throwsWhenLineNotAssociatedWithStop() {
            Line otherLine = TestDataFactory.createLineWithId(UUID.randomUUID(), "L2", "Other Line", "#0000FF");
            Stop otherStop = TestDataFactory.createStopWithId(UUID.randomUUID(), "Other Stop", otherLine);
            Itinerary otherItinerary = TestDataFactory.createItineraryWithStops(otherLine, "Other Direction", otherStop);
            CreateScheduleRequest request = new CreateScheduleRequest("09:00", otherItinerary.getId());

            when(scheduleRepository.findById(testScheduleId)).thenReturn(Optional.of(testSchedule));
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(otherItinerary.getId())).thenReturn(Optional.of(otherItinerary));

            assertThatThrownBy(() -> scheduleService.updateSchedule(testScheduleId, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("not associated with stop");
        }

        @Test
        @DisplayName("throws IllegalArgumentException when duplicate schedule exists")
        void throwsWhenDuplicateExists() {
            CreateScheduleRequest request = new CreateScheduleRequest("10:00", testItineraryId);

            when(scheduleRepository.findById(testScheduleId)).thenReturn(Optional.of(testSchedule));
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                    testStopId, testItineraryId, LocalTime.of(10, 0), testScheduleId)).thenReturn(true);

            assertThatThrownBy(() -> scheduleService.updateSchedule(testScheduleId, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already exists");
        }
    }

    @Nested
    @DisplayName("deleteSchedule")
    class DeleteSchedule {

        @Test
        @DisplayName("deletes an existing schedule")
        void deletesExistingSchedule() {
            when(scheduleRepository.findById(testScheduleId)).thenReturn(Optional.of(testSchedule));

            scheduleService.deleteSchedule(testScheduleId);

            verify(scheduleRepository).delete(testSchedule);
        }

        @Test
        @DisplayName("publishes ScheduleChangedEvent after deletion")
        void publishesEventAfterDeletion() {
            when(scheduleRepository.findById(testScheduleId)).thenReturn(Optional.of(testSchedule));

            scheduleService.deleteSchedule(testScheduleId);

            ArgumentCaptor<ScheduleChangedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getStopId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when schedule not found")
        void throwsWhenScheduleNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(scheduleRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.deleteSchedule(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Schedule");

            verify(scheduleRepository, never()).delete(any());
        }

        @Test
        @DisplayName("publishes event with correct stopId after deletion")
        void publishesEventWithCorrectStopId() {
            UUID specificStopId = UUID.randomUUID();
            Stop specificStop = TestDataFactory.createStopWithId(specificStopId, "Specific Station", testLine);
            Schedule scheduleAtSpecificStop = Schedule.builder()
                    .id(UUID.randomUUID())
                    .time(LocalTime.of(14, 0))
                    .stop(specificStop)
                    .itinerary(testItinerary)
                    .build();
            when(scheduleRepository.findById(scheduleAtSpecificStop.getId()))
                    .thenReturn(Optional.of(scheduleAtSpecificStop));

            scheduleService.deleteSchedule(scheduleAtSpecificStop.getId());

            ArgumentCaptor<ScheduleChangedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getStopId()).isEqualTo(specificStopId);
        }
    }

    @Nested
    @DisplayName("Schedule boundary times")
    class ScheduleBoundaryTimes {

        @Test
        @DisplayName("creates schedule at midnight (00:00)")
        void createsScheduleAtMidnight() {
            CreateScheduleRequest request = new CreateScheduleRequest("00:00", testItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTime(
                    eq(testStopId), eq(testItineraryId), eq(LocalTime.of(0, 0)))).thenReturn(false);
            when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> {
                Schedule s = inv.getArgument(0);
                return Schedule.builder()
                        .id(UUID.randomUUID())
                        .time(s.getTime())
                        .stop(s.getStop())
                        .itinerary(s.getItinerary())
                        .build();
            });

            ScheduleResponse result = scheduleService.createSchedule(testStopId, request);

            assertThat(result.time()).isEqualTo(LocalTime.of(0, 0));
        }

        @Test
        @DisplayName("creates schedule at 23:59")
        void createsScheduleAtEndOfDay() {
            CreateScheduleRequest request = new CreateScheduleRequest("23:59", testItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTime(
                    eq(testStopId), eq(testItineraryId), eq(LocalTime.of(23, 59)))).thenReturn(false);
            when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> {
                Schedule s = inv.getArgument(0);
                return Schedule.builder()
                        .id(UUID.randomUUID())
                        .time(s.getTime())
                        .stop(s.getStop())
                        .itinerary(s.getItinerary())
                        .build();
            });

            ScheduleResponse result = scheduleService.createSchedule(testStopId, request);

            assertThat(result.time()).isEqualTo(LocalTime.of(23, 59));
        }
    }

    @Nested
    @DisplayName("Duplicate detection accuracy")
    class DuplicateDetectionAccuracy {

        @Test
        @DisplayName("allows same stop and itinerary with 1-minute-different time")
        void allowsDifferentTime() {
            CreateScheduleRequest request = new CreateScheduleRequest("08:31", testItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTime(
                    testStopId, testItineraryId, LocalTime.of(8, 31))).thenReturn(false);
            when(scheduleRepository.save(any(Schedule.class))).thenAnswer(inv -> {
                Schedule s = inv.getArgument(0);
                return Schedule.builder()
                        .id(UUID.randomUUID())
                        .time(s.getTime())
                        .stop(s.getStop())
                        .itinerary(s.getItinerary())
                        .build();
            });

            ScheduleResponse result = scheduleService.createSchedule(testStopId, request);

            assertThat(result.time()).isEqualTo(LocalTime.of(8, 31));
            verify(scheduleRepository).save(any(Schedule.class));
        }

        @Test
        @DisplayName("rejects exact same stop, itinerary, and time")
        void rejectsExactDuplicate() {
            CreateScheduleRequest request = new CreateScheduleRequest("08:30", testItineraryId);

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId)).thenReturn(Optional.of(testItinerary));
            when(scheduleRepository.existsByStopIdAndItineraryIdAndTime(
                    testStopId, testItineraryId, LocalTime.of(8, 30))).thenReturn(true);

            assertThatThrownBy(() -> scheduleService.createSchedule(testStopId, request))
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("already exists");

            verify(scheduleRepository, never()).save(any());
        }
    }
}
