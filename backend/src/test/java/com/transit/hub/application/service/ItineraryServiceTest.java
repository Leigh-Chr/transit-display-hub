package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.AddItineraryStopRequest;
import com.transit.hub.application.dto.request.CreateItineraryRequest;
import com.transit.hub.application.dto.response.ItineraryResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.ItineraryStopRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("ItineraryService")
class ItineraryServiceTest {

    @Mock
    private ItineraryRepository itineraryRepository;

    @Mock
    private ItineraryStopRepository itineraryStopRepository;

    @Mock
    private LineRepository lineRepository;

    @Mock
    private StopRepository stopRepository;

    @InjectMocks
    private ItineraryService itineraryService;

    private Line testLine;
    private Itinerary testItinerary;
    private Stop testStop;
    private UUID testLineId;
    private UUID testItineraryId;
    private UUID testStopId;

    @BeforeEach
    void setUp() {
        testLineId = UUID.randomUUID();
        testItineraryId = UUID.randomUUID();
        testStopId = UUID.randomUUID();
        testLine = TestDataFactory.createLineWithId(testLineId, "L1", "Metro Line 1", "#FF5733");
        testItinerary = TestDataFactory.createItineraryWithId(testItineraryId, testLine, "Direction Eastern Terminal");
        testStop = TestDataFactory.createStopWithId(testStopId, "Central Station", testLine);
    }

    @Nested
    @DisplayName("getAllItineraries")
    class GetAllItineraries {

        @Test
        @DisplayName("returns all itineraries")
        void returnsAllItineraries() {
            Itinerary itinerary1 = TestDataFactory.createItinerary(testLine, "Direction East");
            Itinerary itinerary2 = TestDataFactory.createItinerary(testLine, "Direction West");
            when(itineraryRepository.findAllWithLineAndStops()).thenReturn(List.of(itinerary1, itinerary2));

            List<ItineraryResponse> result = itineraryService.getAllItineraries();

            assertThat(result).hasSize(2);
            assertThat(result).extracting(ItineraryResponse::name)
                    .containsExactly("Direction East", "Direction West");
        }

        @Test
        @DisplayName("returns empty list when no itineraries exist")
        void returnsEmptyListWhenNoItineraries() {
            when(itineraryRepository.findAllWithLineAndStops()).thenReturn(List.of());

            List<ItineraryResponse> result = itineraryService.getAllItineraries();

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getItinerary")
    class GetItinerary {

        @Test
        @DisplayName("returns itinerary when found")
        void returnsItineraryWhenFound() {
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId))
                    .thenReturn(Optional.of(testItinerary));

            ItineraryResponse result = itineraryService.getItinerary(testItineraryId);

            assertThat(result.id()).isEqualTo(testItineraryId);
            assertThat(result.name()).isEqualTo("Direction Eastern Terminal");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(itineraryRepository.findByIdWithLineAndStops(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.getItinerary(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Itinerary");
        }
    }

    @Nested
    @DisplayName("getItinerariesByLine")
    class GetItinerariesByLine {

        @Test
        @DisplayName("returns itineraries for a line")
        void returnsItinerariesForLine() {
            when(lineRepository.existsById(testLineId)).thenReturn(true);
            when(itineraryRepository.findByLineIdWithLineAndStops(testLineId))
                    .thenReturn(List.of(testItinerary));

            List<ItineraryResponse> result = itineraryService.getItinerariesByLine(testLineId);

            assertThat(result).hasSize(1);
            assertThat(result.get(0).name()).isEqualTo("Direction Eastern Terminal");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when line not found")
        void throwsWhenLineNotFound() {
            UUID unknownLineId = UUID.randomUUID();
            when(lineRepository.existsById(unknownLineId)).thenReturn(false);

            assertThatThrownBy(() -> itineraryService.getItinerariesByLine(unknownLineId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");
        }
    }

    @Nested
    @DisplayName("createItinerary")
    class CreateItinerary {

        @Test
        @DisplayName("creates new itinerary")
        void createsNewItinerary() {
            CreateItineraryRequest request = new CreateItineraryRequest(testLineId, "New Direction", null);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(itineraryRepository.existsByLineIdAndName(testLineId, "New Direction")).thenReturn(false);
            when(itineraryRepository.save(any(Itinerary.class))).thenAnswer(inv -> {
                Itinerary it = inv.getArgument(0);
                it = Itinerary.builder()
                        .id(UUID.randomUUID())
                        .line(it.getLine())
                        .name(it.getName())
                        .build();
                return it;
            });
            when(itineraryRepository.findByIdWithLineAndStops(any())).thenReturn(Optional.of(testItinerary));

            ItineraryResponse result = itineraryService.createItinerary(request);

            assertThat(result).isNotNull();
            verify(itineraryRepository).save(any(Itinerary.class));
        }

        @Test
        @DisplayName("throws ValidationException when name already exists for line")
        void throwsWhenNameAlreadyExists() {
            CreateItineraryRequest request = new CreateItineraryRequest(testLineId, "Existing Name", null);
            when(lineRepository.findById(testLineId)).thenReturn(Optional.of(testLine));
            when(itineraryRepository.existsByLineIdAndName(testLineId, "Existing Name")).thenReturn(true);

            assertThatThrownBy(() -> itineraryService.createItinerary(request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("already exists");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when line not found")
        void throwsWhenLineNotFound() {
            UUID unknownLineId = UUID.randomUUID();
            CreateItineraryRequest request = new CreateItineraryRequest(unknownLineId, "Direction", null);
            when(lineRepository.findById(unknownLineId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.createItinerary(request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Line");
        }
    }

    @Nested
    @DisplayName("deleteItinerary")
    class DeleteItinerary {

        @Test
        @DisplayName("deletes existing itinerary")
        void deletesExistingItinerary() {
            when(itineraryRepository.existsById(testItineraryId)).thenReturn(true);

            itineraryService.deleteItinerary(testItineraryId);

            verify(itineraryStopRepository).deleteByItineraryId(testItineraryId);
            verify(itineraryRepository).deleteById(testItineraryId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when itinerary not found")
        void throwsWhenItineraryNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(itineraryRepository.existsById(unknownId)).thenReturn(false);

            assertThatThrownBy(() -> itineraryService.deleteItinerary(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Itinerary");

            verify(itineraryRepository, never()).deleteById(any());
        }
    }

    @Nested
    @DisplayName("addStopToItinerary")
    class AddStopToItinerary {

        @Test
        @DisplayName("adds stop to itinerary")
        void addsStopToItinerary() {
            AddItineraryStopRequest request = new AddItineraryStopRequest(testStopId, null);
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId))
                    .thenReturn(Optional.of(testItinerary));
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryStopRepository.existsByItineraryIdAndStopId(testItineraryId, testStopId))
                    .thenReturn(false);
            when(itineraryStopRepository.findMaxPositionByItineraryId(testItineraryId)).thenReturn(null);
            when(itineraryRepository.save(any(Itinerary.class))).thenReturn(testItinerary);

            ItineraryResponse result = itineraryService.addStopToItinerary(testItineraryId, request);

            assertThat(result).isNotNull();
            verify(itineraryRepository).save(any(Itinerary.class));
        }

        @Test
        @DisplayName("throws ValidationException when stop already in itinerary")
        void throwsWhenStopAlreadyInItinerary() {
            AddItineraryStopRequest request = new AddItineraryStopRequest(testStopId, null);
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId))
                    .thenReturn(Optional.of(testItinerary));
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(itineraryStopRepository.existsByItineraryIdAndStopId(testItineraryId, testStopId))
                    .thenReturn(true);

            assertThatThrownBy(() -> itineraryService.addStopToItinerary(testItineraryId, request))
                    .isInstanceOf(ValidationException.class)
                    .hasMessageContaining("already in this itinerary");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when itinerary not found")
        void throwsWhenItineraryNotFound() {
            UUID unknownId = UUID.randomUUID();
            AddItineraryStopRequest request = new AddItineraryStopRequest(testStopId, null);
            when(itineraryRepository.findByIdWithLineAndStops(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.addStopToItinerary(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Itinerary");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownStopId = UUID.randomUUID();
            AddItineraryStopRequest request = new AddItineraryStopRequest(unknownStopId, null);
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId))
                    .thenReturn(Optional.of(testItinerary));
            when(stopRepository.findById(unknownStopId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.addStopToItinerary(testItineraryId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }
    }

    @Nested
    @DisplayName("removeStopFromItinerary")
    class RemoveStopFromItinerary {

        @Test
        @DisplayName("throws EntityNotFoundException when itinerary not found")
        void throwsWhenItineraryNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(itineraryRepository.findByIdWithLineAndStops(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.removeStopFromItinerary(unknownId, testStopId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Itinerary");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownStopId = UUID.randomUUID();
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId))
                    .thenReturn(Optional.of(testItinerary));
            when(stopRepository.existsById(unknownStopId)).thenReturn(false);

            assertThatThrownBy(() -> itineraryService.removeStopFromItinerary(testItineraryId, unknownStopId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }
    }

    @Nested
    @DisplayName("getItineraryEntity")
    class GetItineraryEntity {

        @Test
        @DisplayName("returns itinerary entity when found")
        void returnsEntityWhenFound() {
            when(itineraryRepository.findByIdWithLineAndStops(testItineraryId))
                    .thenReturn(Optional.of(testItinerary));

            Itinerary result = itineraryService.getItineraryEntity(testItineraryId);

            assertThat(result).isEqualTo(testItinerary);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(itineraryRepository.findByIdWithLineAndStops(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> itineraryService.getItineraryEntity(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Itinerary");
        }
    }
}
