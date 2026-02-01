package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateTimedEntryRequest;
import com.transit.hub.application.dto.response.TimedEntryResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.TimedEntry;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TimedEntryRepository;
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
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ScheduleService")
class ScheduleServiceTest {

    @Mock
    private TimedEntryRepository timedEntryRepository;

    @Mock
    private StopRepository stopRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private ScheduleService scheduleService;

    private Line testLine;
    private Stop testStop;
    private TimedEntry testEntry;
    private UUID testStopId;
    private UUID testEntryId;

    @BeforeEach
    void setUp() {
        testLine = TestDataFactory.createLine("L1", "Metro Line 1", "#FF5733");
        testStopId = UUID.randomUUID();
        testStop = TestDataFactory.createStopWithId(testStopId, "Central Station", testLine);
        testEntryId = UUID.randomUUID();
        testEntry = TestDataFactory.createTimedEntryWithId(testEntryId, LocalTime.of(8, 30), testStop);
    }

    @Nested
    @DisplayName("getScheduleForStop")
    class GetScheduleForStop {

        @Test
        @DisplayName("returns schedule entries for stop")
        void returnsEntriesForStop() {
            TimedEntry entry1 = TestDataFactory.createTimedEntry(LocalTime.of(8, 0), testStop);
            TimedEntry entry2 = TestDataFactory.createTimedEntry(LocalTime.of(8, 30), testStop);
            when(stopRepository.existsById(testStopId)).thenReturn(true);
            when(timedEntryRepository.findByStopIdOrderByTime(testStopId)).thenReturn(List.of(entry1, entry2));

            List<TimedEntryResponse> result = scheduleService.getScheduleForStop(testStopId);

            assertThat(result).hasSize(2);
            assertThat(result).extracting(TimedEntryResponse::time)
                    .containsExactly(LocalTime.of(8, 0), LocalTime.of(8, 30));
        }

        @Test
        @DisplayName("returns empty list when no entries")
        void returnsEmptyWhenNoEntries() {
            when(stopRepository.existsById(testStopId)).thenReturn(true);
            when(timedEntryRepository.findByStopIdOrderByTime(testStopId)).thenReturn(List.of());

            List<TimedEntryResponse> result = scheduleService.getScheduleForStop(testStopId);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(stopRepository.existsById(unknownId)).thenReturn(false);

            assertThatThrownBy(() -> scheduleService.getScheduleForStop(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }
    }

    @Nested
    @DisplayName("createTimedEntry")
    class CreateTimedEntry {

        @Test
        @DisplayName("creates entry with valid request")
        void withValidRequest_Succeeds() {
            CreateTimedEntryRequest request = new CreateTimedEntryRequest("09:15");
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.save(any(TimedEntry.class))).thenAnswer(invocation -> {
                TimedEntry saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            TimedEntryResponse result = scheduleService.createTimedEntry(testStopId, request);

            assertThat(result.time()).isEqualTo(LocalTime.of(9, 15));
            assertThat(result.stopId()).isEqualTo(testStopId);

            ArgumentCaptor<TimedEntry> captor = ArgumentCaptor.forClass(TimedEntry.class);
            verify(timedEntryRepository).save(captor.capture());
            assertThat(captor.getValue().getTime()).isEqualTo(LocalTime.of(9, 15));
            assertThat(captor.getValue().getStop()).isEqualTo(testStop);
        }

        @Test
        @DisplayName("publishes ScheduleChangedEvent after creation")
        void publishesEvent() {
            CreateTimedEntryRequest request = new CreateTimedEntryRequest("09:15");
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.save(any(TimedEntry.class))).thenAnswer(invocation -> {
                TimedEntry saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            scheduleService.createTimedEntry(testStopId, request);

            ArgumentCaptor<ScheduleChangedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getStopId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void withNonExistentStop_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            CreateTimedEntryRequest request = new CreateTimedEntryRequest("09:15");
            when(stopRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.createTimedEntry(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");

            verify(timedEntryRepository, never()).save(any());
            verify(eventPublisher, never()).publishEvent(any());
        }

        @Test
        @DisplayName("parses different time formats correctly")
        void parsesDifferentTimeFormats() {
            CreateTimedEntryRequest request = new CreateTimedEntryRequest("14:05");
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(timedEntryRepository.save(any(TimedEntry.class))).thenAnswer(invocation -> {
                TimedEntry saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            TimedEntryResponse result = scheduleService.createTimedEntry(testStopId, request);

            assertThat(result.time()).isEqualTo(LocalTime.of(14, 5));
        }
    }

    @Nested
    @DisplayName("updateTimedEntry")
    class UpdateTimedEntry {

        @Test
        @DisplayName("updates entry with valid request")
        void withValidRequest_Succeeds() {
            CreateTimedEntryRequest request = new CreateTimedEntryRequest("10:30");
            when(timedEntryRepository.findById(testEntryId)).thenReturn(Optional.of(testEntry));
            when(timedEntryRepository.save(any(TimedEntry.class))).thenReturn(testEntry);

            TimedEntryResponse result = scheduleService.updateTimedEntry(testEntryId, request);

            ArgumentCaptor<TimedEntry> captor = ArgumentCaptor.forClass(TimedEntry.class);
            verify(timedEntryRepository).save(captor.capture());
            assertThat(captor.getValue().getTime()).isEqualTo(LocalTime.of(10, 30));
        }

        @Test
        @DisplayName("publishes ScheduleChangedEvent after update")
        void publishesEvent() {
            CreateTimedEntryRequest request = new CreateTimedEntryRequest("10:30");
            when(timedEntryRepository.findById(testEntryId)).thenReturn(Optional.of(testEntry));
            when(timedEntryRepository.save(any(TimedEntry.class))).thenReturn(testEntry);

            scheduleService.updateTimedEntry(testEntryId, request);

            ArgumentCaptor<ScheduleChangedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getStopId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when entry not found")
        void withNonExistentEntry_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            CreateTimedEntryRequest request = new CreateTimedEntryRequest("10:30");
            when(timedEntryRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.updateTimedEntry(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("TimedEntry");
        }
    }

    @Nested
    @DisplayName("deleteTimedEntry")
    class DeleteTimedEntry {

        @Test
        @DisplayName("deletes existing entry")
        void withExistingId_Succeeds() {
            when(timedEntryRepository.findById(testEntryId)).thenReturn(Optional.of(testEntry));

            scheduleService.deleteTimedEntry(testEntryId);

            verify(timedEntryRepository).delete(testEntry);
        }

        @Test
        @DisplayName("publishes ScheduleChangedEvent after deletion")
        void publishesEvent() {
            when(timedEntryRepository.findById(testEntryId)).thenReturn(Optional.of(testEntry));

            scheduleService.deleteTimedEntry(testEntryId);

            ArgumentCaptor<ScheduleChangedEvent> eventCaptor = ArgumentCaptor.forClass(ScheduleChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getStopId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when entry not found")
        void withNonExistentId_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(timedEntryRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> scheduleService.deleteTimedEntry(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("TimedEntry");

            verify(timedEntryRepository, never()).delete(any());
            verify(eventPublisher, never()).publishEvent(any());
        }
    }
}
