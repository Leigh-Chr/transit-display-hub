package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateStopRequest;
import com.transit.hub.application.dto.response.StopResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
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

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("StopService")
class StopServiceTest {

    @Mock
    private StopRepository stopRepository;

    @Mock
    private LineRepository lineRepository;

    @Mock
    private TimedEntryRepository timedEntryRepository;

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private BroadcastMessageRepository messageRepository;

    @InjectMocks
    private StopService stopService;

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
    @DisplayName("getAllStops")
    class GetAllStops {

        @Test
        @DisplayName("returns all stops with lines info")
        void returnsAllStops() {
            Stop stop1 = TestDataFactory.createStop("Station 1", testLine);
            Stop stop2 = TestDataFactory.createStop("Station 2", testLine);
            when(stopRepository.findAllWithLinesAndDevices()).thenReturn(List.of(stop1, stop2));

            List<StopResponse> result = stopService.getAllStops();

            assertThat(result).hasSize(2);
            assertThat(result).extracting(StopResponse::name).containsExactly("Station 1", "Station 2");
            assertThat(result).allSatisfy(r -> assertThat(r.lines()).extracting(StopResponse.LineInfo::code).contains("L1"));
        }

        @Test
        @DisplayName("returns empty list when no stops exist")
        void returnsEmptyListWhenNoStops() {
            when(stopRepository.findAllWithLinesAndDevices()).thenReturn(List.of());

            List<StopResponse> result = stopService.getAllStops();

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getStopsByLine")
    class GetStopsByLine {

        @Test
        @DisplayName("returns stops for specific line")
        void returnsStopsForLine() {
            Stop stop1 = TestDataFactory.createStop("Station 1", testLine);
            when(stopRepository.findByLineIdWithLinesAndDevices(testLineId)).thenReturn(List.of(stop1));

            List<StopResponse> result = stopService.getStopsByLine(testLineId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).lines()).extracting(StopResponse.LineInfo::id).contains(testLineId);
        }

        @Test
        @DisplayName("returns empty list when line has no stops")
        void returnsEmptyWhenNoStops() {
            when(stopRepository.findByLineIdWithLinesAndDevices(testLineId)).thenReturn(List.of());

            List<StopResponse> result = stopService.getStopsByLine(testLineId);

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getStop")
    class GetStop {

        @Test
        @DisplayName("returns stop when found")
        void returnsStopWhenFound() {
            when(stopRepository.findByIdWithLinesAndDevices(testStopId)).thenReturn(Optional.of(testStop));

            StopResponse result = stopService.getStop(testStopId);

            assertThat(result.id()).isEqualTo(testStopId);
            assertThat(result.name()).isEqualTo("Central Station");
            assertThat(result.lines()).extracting(StopResponse.LineInfo::id).contains(testLineId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(stopRepository.findByIdWithLinesAndDevices(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stopService.getStop(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }
    }

    @Nested
    @DisplayName("createStop")
    class CreateStop {

        @Test
        @DisplayName("creates stop with valid request")
        void withValidRequest_Succeeds() {
            CreateStopRequest request = new CreateStopRequest("New Station", Set.of(testLineId));
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(stopRepository.save(any(Stop.class))).thenAnswer(invocation -> {
                Stop saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            StopResponse result = stopService.createStop(request);

            assertThat(result.name()).isEqualTo("New Station");
            assertThat(result.lines()).extracting(StopResponse.LineInfo::id).contains(testLineId);
            assertThat(result.lines()).extracting(StopResponse.LineInfo::code).contains("L1");

            ArgumentCaptor<Stop> captor = ArgumentCaptor.forClass(Stop.class);
            verify(stopRepository).save(captor.capture());
            assertThat(captor.getValue().getName()).isEqualTo("New Station");
            assertThat(captor.getValue().getLines()).contains(testLine);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when line not found")
        void withNonExistentLine_ThrowsNotFound() {
            UUID unknownLineId = UUID.randomUUID();
            CreateStopRequest request = new CreateStopRequest("Station", Set.of(unknownLineId));
            when(lineRepository.findById(unknownLineId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stopService.createStop(request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");

            verify(stopRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("updateStop")
    class UpdateStop {

        @Test
        @DisplayName("updates stop with valid request")
        void withValidRequest_Succeeds() {
            CreateStopRequest request = new CreateStopRequest("Updated Station", Set.of(testLineId));
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(stopRepository.save(any(Stop.class))).thenReturn(testStop);

            StopResponse result = stopService.updateStop(testStopId, request);

            verify(stopRepository).save(any(Stop.class));
        }

        @Test
        @DisplayName("allows changing stop to different lines")
        void changingLines_Succeeds() {
            UUID newLineId = UUID.randomUUID();
            Line newLine = TestDataFactory.createLineWithId(newLineId, "L2", "Line 2", "#00FF00");
            CreateStopRequest request = new CreateStopRequest("Station", Set.of(newLineId));

            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(lineRepository.findById(newLineId)).thenReturn(Optional.of(newLine));
            when(stopRepository.save(any(Stop.class))).thenAnswer(invocation -> invocation.getArgument(0));

            StopResponse result = stopService.updateStop(testStopId, request);

            ArgumentCaptor<Stop> captor = ArgumentCaptor.forClass(Stop.class);
            verify(stopRepository).save(captor.capture());
            assertThat(captor.getValue().getLines()).contains(newLine);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void withNonExistentStop_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            CreateStopRequest request = new CreateStopRequest("Station", Set.of(testLineId));
            when(stopRepository.findByIdWithLines(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stopService.updateStop(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when new line not found")
        void withNonExistentLine_ThrowsNotFound() {
            UUID unknownLineId = UUID.randomUUID();
            CreateStopRequest request = new CreateStopRequest("Station", Set.of(unknownLineId));
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));
            when(lineRepository.findById(unknownLineId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stopService.updateStop(testStopId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");
        }
    }

    @Nested
    @DisplayName("deleteStop")
    class DeleteStop {

        @Test
        @DisplayName("deletes existing stop and related entities")
        void withExistingId_Succeeds() {
            when(stopRepository.existsById(testStopId)).thenReturn(true);

            stopService.deleteStop(testStopId);

            verify(timedEntryRepository).deleteByStopId(testStopId);
            verify(deviceRepository).deleteByStopId(testStopId);
            verify(messageRepository).deleteByScopeTypeAndScopeId(MessageScope.STOP, testStopId);
            verify(stopRepository).deleteById(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void withNonExistentId_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(stopRepository.existsById(unknownId)).thenReturn(false);

            assertThatThrownBy(() -> stopService.deleteStop(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");

            verify(stopRepository, never()).deleteById(any());
        }
    }

    @Nested
    @DisplayName("getStopEntity")
    class GetStopEntity {

        @Test
        @DisplayName("returns stop entity when found")
        void returnsEntityWhenFound() {
            when(stopRepository.findByIdWithLines(testStopId)).thenReturn(Optional.of(testStop));

            Stop result = stopService.getStopEntity(testStopId);

            assertThat(result).isEqualTo(testStop);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(stopRepository.findByIdWithLines(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> stopService.getStopEntity(unknownId))
                    .isInstanceOf(EntityNotFoundException.class);
        }
    }
}
