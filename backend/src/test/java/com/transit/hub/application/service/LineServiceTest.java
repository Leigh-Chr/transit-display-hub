package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
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
    private ScheduleRepository scheduleRepository;

    @Mock
    private BroadcastMessageRepository messageRepository;

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
            when(lineRepository.findAllWithStopsAndRoutes()).thenReturn(List.of(line1, line2));

            List<LineResponse> result = lineService.getAllLines();

            assertThat(result).hasSize(2);
            assertThat(result).extracting(LineResponse::code).containsExactly("L1", "L2");
        }

        @Test
        @DisplayName("returns empty list when no lines exist")
        void returnsEmptyListWhenNoLines() {
            when(lineRepository.findAllWithStopsAndRoutes()).thenReturn(List.of());

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
        @DisplayName("creates line with valid request")
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
        @DisplayName("updates line with valid request")
        void withValidRequest_Succeeds() {
            CreateLineRequest request = new CreateLineRequest("L1-NEW", "Updated Line", "#0000FF", null);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(lineRepository.existsByCode("L1-NEW")).thenReturn(false);
            when(lineRepository.save(any(Line.class))).thenReturn(testLine);

            LineResponse result = lineService.updateLine(testLineId, request);

            verify(lineRepository).save(any(Line.class));
        }

        @Test
        @DisplayName("succeeds when keeping same code")
        void keepingSameCode_Succeeds() {
            CreateLineRequest request = new CreateLineRequest("L1", "Updated Name", "#0000FF", null);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(lineRepository.save(any(Line.class))).thenReturn(testLine);

            lineService.updateLine(testLineId, request);

            verify(lineRepository, never()).existsByCode(anyString());
            verify(lineRepository).save(any(Line.class));
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
        @DisplayName("deletes existing line and related entities")
        void withExistingId_Succeeds() {
            when(lineRepository.existsById(testLineId)).thenReturn(true);

            lineService.deleteLine(testLineId);

            verify(scheduleRepository).deleteByItineraryLineId(testLineId);
            verify(itineraryRepository).deleteByLineId(testLineId);
            verify(messageRepository).deleteByScopeTypeAndScopeId(MessageScope.LINE, testLineId);
            verify(lineRepository).deleteById(testLineId);
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
        @DisplayName("with search string calls findBySearchWithStopsAndRoutes")
        void withSearch() {
            Page<Line> page = new PageImpl<>(List.of(testLine), pageable, 1);
            when(lineRepository.findBySearchWithStopsAndRoutes(eq("Metro"), eq(pageable)))
                    .thenReturn(page);

            PageResponse<LineResponse> result = lineService.getAllLines("Metro", pageable);

            assertThat(result.content()).hasSize(1);
            assertThat(result.totalElements()).isEqualTo(1);
            verify(lineRepository).findBySearchWithStopsAndRoutes("Metro", pageable);
        }

        @Test
        @DisplayName("without search calls findAllWithStopsAndRoutes")
        void withoutSearch() {
            Page<Line> page = new PageImpl<>(List.of(testLine), pageable, 1);
            when(lineRepository.findAllWithStopsAndRoutes(eq(pageable)))
                    .thenReturn(page);

            PageResponse<LineResponse> result = lineService.getAllLines(null, pageable);

            assertThat(result.content()).hasSize(1);
            assertThat(result.totalElements()).isEqualTo(1);
            verify(lineRepository).findAllWithStopsAndRoutes(pageable);
        }

        @Test
        @DisplayName("with blank search treats as no search")
        void withBlankSearch() {
            Page<Line> page = new PageImpl<>(List.of(testLine), pageable, 1);
            when(lineRepository.findAllWithStopsAndRoutes(eq(pageable)))
                    .thenReturn(page);

            PageResponse<LineResponse> result = lineService.getAllLines("   ", pageable);

            assertThat(result.content()).hasSize(1);
            verify(lineRepository).findAllWithStopsAndRoutes(pageable);
            verify(lineRepository, never()).findBySearchWithStopsAndRoutes(any(), any());
        }
    }

    @Nested
    @DisplayName("getLineEntity")
    class GetLineEntity {

        @Test
        @DisplayName("returns line entity when found")
        void returnsEntityWhenFound() {
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));

            Line result = lineService.getLineEntity(testLineId);

            assertThat(result).isEqualTo(testLine);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(lineRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> lineService.getLineEntity(unknownId))
                    .isInstanceOf(EntityNotFoundException.class);
        }
    }
}
