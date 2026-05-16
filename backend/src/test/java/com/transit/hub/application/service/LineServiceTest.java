package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.ItineraryStopRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.springframework.context.ApplicationEventPublisher;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.transit.hub.application.dto.response.PageResponse;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("LineService")
class LineServiceTest {

    @Mock
    private LineRepository lineRepository;

    @Mock
    private ItineraryRepository itineraryRepository;

    @Mock
    private ItineraryStopRepository itineraryStopRepository;

    @Mock
    private ScheduleRepository scheduleRepository;

    @Mock
    private BroadcastMessageRepository messageRepository;

    @Mock
    private StopRepository stopRepository;

    @Mock
    private ApplicationEventPublisher eventPublisher;

    @InjectMocks
    private LineService lineService;

    private Line testLine;
    private UUID testLineId;

    @BeforeEach
    void setUp() {
        testLineId = UUID.randomUUID();
        testLine = TestDataFactory.createLineWithId(testLineId, "L1", "Metro Line 1", "#FF5733");
    }

    @Nested
    @DisplayName("getAllLines")
    class GetAllLines {

        @Test
        @DisplayName("returns all lines")
        void returnsAllLines() {
            Line line1 = TestDataFactory.createLine("L1", "Line 1", "#FF5733");
            Line line2 = TestDataFactory.createLine("L2", "Line 2", "#33FF57");
            UUID id1 = line1.getId();
            UUID id2 = line2.getId();
            when(lineRepository.findAllIds(any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(id1, id2), Pageable.unpaged(), 2));
            when(lineRepository.findAllByIdInWithStopsAndRoutes(List.of(id1, id2)))
                    .thenReturn(List.of(line1, line2));

            List<LineResponse> result = lineService.getAllLines();

            assertThat(result).hasSize(2);
            assertThat(result).extracting(LineResponse::code).containsExactly("L1", "L2");
        }

        @Test
        @DisplayName("returns empty list when no lines exist")
        void returnsEmptyListWhenNoLines() {
            when(lineRepository.findAllIds(any(Pageable.class)))
                    .thenReturn(new PageImpl<>(List.of(), Pageable.unpaged(), 0));

            List<LineResponse> result = lineService.getAllLines();

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getLine")
    class GetLine {

        @Test
        @DisplayName("returns line when found")
        void returnsLineWhenFound() {
            when(lineRepository.findByIdWithStopsAndRoutes(testLineId)).thenReturn(Optional.of(testLine));

            LineResponse result = lineService.getLine(testLineId);

            assertThat(result.id()).isEqualTo(testLineId);
            assertThat(result.code()).isEqualTo("L1");
            assertThat(result.name()).isEqualTo("Metro Line 1");
            assertThat(result.color()).isEqualTo("#FF5733");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(lineRepository.findByIdWithStopsAndRoutes(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> lineService.getLine(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");
        }
    }

    @Nested
    @DisplayName("createLine")
    class CreateLine {

        @Test
        @DisplayName("creates line with valid request and publishes NetworkChangedEvent")
        void withValidRequest_Succeeds() {
            CreateLineRequest request = new CreateLineRequest("L2", "New Line", "#00FF00", null);
            when(lineRepository.existsByCode("L2")).thenReturn(false);
            when(lineRepository.save(any(Line.class))).thenAnswer(invocation -> {
                Line saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            LineResponse result = lineService.createLine(request);

            assertThat(result.code()).isEqualTo("L2");
            assertThat(result.name()).isEqualTo("New Line");
            assertThat(result.color()).isEqualTo("#00FF00");

            ArgumentCaptor<Line> captor = ArgumentCaptor.forClass(Line.class);
            verify(lineRepository).save(captor.capture());
            assertThat(captor.getValue().getCode()).isEqualTo("L2");

            ArgumentCaptor<NetworkChangedEvent> eventCaptor = ArgumentCaptor.forClass(NetworkChangedEvent.class);
            verify(eventPublisher).publishEvent(eventCaptor.capture());
            assertThat(eventCaptor.getValue().getAffectedStopIds()).isEmpty();
        }

        @Test
        @DisplayName("throws ValidationException when code already exists")
        void withDuplicateCode_ThrowsValidation() {
            CreateLineRequest request = new CreateLineRequest("L1", "Duplicate Line", "#FF0000", null);
            when(lineRepository.existsByCode("L1")).thenReturn(true);

            assertThatThrownBy(() -> lineService.createLine(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("L1")
                    .hasMessageContaining("already exists");

            verify(lineRepository, never()).save(any());
        }
    }

    @Nested
    @DisplayName("updateLine")
    class UpdateLine {

        @Test
        @DisplayName("updates line with valid request and publishes NetworkChangedEvent with affected stopIds")
        void withValidRequest_Succeeds() {
            Stop stop1 = TestDataFactory.createStop("S1", testLine);
            Stop stop2 = TestDataFactory.createStop("S2", testLine);
            CreateLineRequest request = new CreateLineRequest("L1-NEW", "Updated Line", "#0000FF", null);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(lineRepository.existsByCode("L1-NEW")).thenReturn(false);
            when(lineRepository.save(any(Line.class))).thenReturn(testLine);
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of(stop1, stop2));

            LineResponse result = lineService.updateLine(testLineId, request);

            verify(lineRepository).save(any(Line.class));
            ArgumentCaptor<NetworkChangedEvent> captor = ArgumentCaptor.forClass(NetworkChangedEvent.class);
            verify(eventPublisher).publishEvent(captor.capture());
            assertThat(captor.getValue().getAffectedStopIds())
                    .containsExactlyInAnyOrder(stop1.getId(), stop2.getId());
        }

        @Test
        @DisplayName("succeeds when keeping same code")
        void keepingSameCode_Succeeds() {
            CreateLineRequest request = new CreateLineRequest("L1", "Updated Name", "#0000FF", null);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(lineRepository.save(any(Line.class))).thenReturn(testLine);
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of());

            lineService.updateLine(testLineId, request);

            verify(lineRepository, never()).existsByCode(anyString());
            verify(lineRepository).save(any(Line.class));
            verify(eventPublisher).publishEvent(any(NetworkChangedEvent.class));
        }

        @Test
        @DisplayName("throws ValidationException when changing to existing code")
        void changingToExistingCode_ThrowsValidation() {
            CreateLineRequest request = new CreateLineRequest("L2", "New Name", "#0000FF", null);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(lineRepository.existsByCode("L2")).thenReturn(true);

            assertThatThrownBy(() -> lineService.updateLine(testLineId, request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("L2")
                    .hasMessageContaining("already exists");

            verify(lineRepository, never()).save(any());
        }

        @Test
        @DisplayName("throws EntityNotFoundException when line not found")
        void withNonExistentId_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            CreateLineRequest request = new CreateLineRequest("L1", "Name", "#FF0000", null);
            when(lineRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> lineService.updateLine(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");
        }
    }

    @Nested
    @DisplayName("deleteLine")
    class DeleteLine {

        @Test
        @DisplayName("deletes existing line, related entities, and publishes NetworkChangedEvent")
        void withExistingId_Succeeds() {
            Stop stop1 = TestDataFactory.createStop("S1", testLine);
            when(lineRepository.existsById(testLineId)).thenReturn(true);
            when(stopRepository.findByLineId(testLineId)).thenReturn(List.of(stop1));

            lineService.deleteLine(testLineId);

            verify(scheduleRepository).deleteByItineraryLineId(testLineId);
            verify(itineraryStopRepository).deleteByItineraryLineId(testLineId);
            verify(itineraryRepository).deleteByLineId(testLineId);
            verify(messageRepository).deleteByScopeTypeAndScopeId(MessageScope.LINE, testLineId);
            verify(lineRepository).deleteById(testLineId);

            ArgumentCaptor<NetworkChangedEvent> captor = ArgumentCaptor.forClass(NetworkChangedEvent.class);
            verify(eventPublisher).publishEvent(captor.capture());
            assertThat(captor.getValue().getAffectedStopIds()).contains(stop1.getId());
        }

        @Test
        @DisplayName("throws EntityNotFoundException when line not found")
        void withNonExistentId_ThrowsNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(lineRepository.existsById(unknownId)).thenReturn(false);

            assertThatThrownBy(() -> lineService.deleteLine(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");

            verify(lineRepository, never()).deleteById(any());
        }
    }

    @Nested
    @DisplayName("getAllLines (paginated)")
    class GetAllLinesPaginated {

        private final Pageable pageable = PageRequest.of(0, 10);

        @Test
        @DisplayName("with search string pages over ids first then hydrates the page")
        void withSearch() {
            Page<UUID> idsPage = new PageImpl<>(List.of(testLineId), pageable, 1);
            when(lineRepository.findIdsBySearch(eq("Metro"), eq(pageable))).thenReturn(idsPage);
            when(lineRepository.findAllByIdInWithStopsAndRoutes(List.of(testLineId)))
                    .thenReturn(List.of(testLine));

            PageResponse<LineResponse> result = lineService.getAllLines("Metro", pageable);

            assertThat(result.content()).hasSize(1);
            assertThat(result.totalElements()).isEqualTo(1);
            verify(lineRepository).findIdsBySearch("Metro", pageable);
            verify(lineRepository).findAllByIdInWithStopsAndRoutes(List.of(testLineId));
        }

        @Test
        @DisplayName("without search pages over all ids and hydrates that page")
        void withoutSearch() {
            Page<UUID> idsPage = new PageImpl<>(List.of(testLineId), pageable, 1);
            when(lineRepository.findAllIds(eq(pageable))).thenReturn(idsPage);
            when(lineRepository.findAllByIdInWithStopsAndRoutes(List.of(testLineId)))
                    .thenReturn(List.of(testLine));

            PageResponse<LineResponse> result = lineService.getAllLines(null, pageable);

            assertThat(result.content()).hasSize(1);
            assertThat(result.totalElements()).isEqualTo(1);
            verify(lineRepository).findAllIds(pageable);
            verify(lineRepository).findAllByIdInWithStopsAndRoutes(List.of(testLineId));
        }

        @Test
        @DisplayName("with blank search treats as no search and skips findIdsBySearch")
        void withBlankSearch() {
            Page<UUID> idsPage = new PageImpl<>(List.of(testLineId), pageable, 1);
            when(lineRepository.findAllIds(eq(pageable))).thenReturn(idsPage);
            when(lineRepository.findAllByIdInWithStopsAndRoutes(List.of(testLineId)))
                    .thenReturn(List.of(testLine));

            PageResponse<LineResponse> result = lineService.getAllLines("   ", pageable);

            assertThat(result.content()).hasSize(1);
            verify(lineRepository).findAllIds(pageable);
            verify(lineRepository, never()).findIdsBySearch(any(), any());
        }

        @Test
        @DisplayName("empty id page short-circuits the second query")
        void emptyIdsSkipHydrate() {
            Page<UUID> empty = new PageImpl<>(List.of(), pageable, 0);
            when(lineRepository.findAllIds(eq(pageable))).thenReturn(empty);

            PageResponse<LineResponse> result = lineService.getAllLines(null, pageable);

            assertThat(result.content()).isEmpty();
            assertThat(result.totalElements()).isZero();
            verify(lineRepository, never()).findAllByIdInWithStopsAndRoutes(any());
        }
    }
}
