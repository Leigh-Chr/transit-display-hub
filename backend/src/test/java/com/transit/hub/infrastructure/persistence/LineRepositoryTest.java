package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.LineType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.cache.autoconfigure.CacheAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ImportAutoConfiguration(CacheAutoConfiguration.class)
@ActiveProfiles("test")
@DisplayName("LineRepository")
class LineRepositoryTest {

    @Autowired
    private LineRepository repository;

    @Autowired
    private TestEntityManager em;

    private Line lineM1;
    private Line lineB2;
    private Line lineT3;
    private Stop stopAlpha;
    private Stop stopBeta;
    private Itinerary itineraryM1;

    @BeforeEach
    void setUp() {
        lineM1 = Line.builder()
                .code("M1")
                .name("Metro Line 1")
                .color("#FF0000")
                .type(LineType.METRO)
                .build();
        em.persist(lineM1);

        lineB2 = Line.builder()
                .code("B2")
                .name("Bus Line 2")
                .color("#00FF00")
                .type(LineType.BUS)
                .build();
        em.persist(lineB2);

        lineT3 = Line.builder()
                .code("T3")
                .name("Tram Line 3")
                .color("#0000FF")
                .type(LineType.TRAM)
                .build();
        em.persist(lineT3);

        stopAlpha = Stop.builder().name("Station Alpha").build();
        stopAlpha.addLine(lineM1);
        em.persist(stopAlpha);

        stopBeta = Stop.builder().name("Station Beta").build();
        stopBeta.addLine(lineM1);
        stopBeta.addLine(lineB2);
        em.persist(stopBeta);

        itineraryM1 = Itinerary.builder()
                .line(lineM1)
                .name("Alpha to Beta")
                .build();
        em.persist(itineraryM1);

        ItineraryStop is1 = ItineraryStop.builder()
                .itinerary(itineraryM1)
                .stop(stopAlpha)
                .position(0)
                .build();
        em.persist(is1);

        ItineraryStop is2 = ItineraryStop.builder()
                .itinerary(itineraryM1)
                .stop(stopBeta)
                .position(1)
                .build();
        em.persist(is2);

        em.flush();
        em.clear();
    }

    @Nested
    @DisplayName("findByCode")
    class FindByCode {

        @Test
        @DisplayName("returns line when code exists")
        void returnsLineWhenCodeExists() {
            Optional<Line> result = repository.findByCode("M1");

            assertThat(result).isPresent();
            assertThat(result.get().getName()).isEqualTo("Metro Line 1");
            assertThat(result.get().getType()).isEqualTo(LineType.METRO);
        }

        @Test
        @DisplayName("returns empty when code does not exist")
        void returnsEmptyWhenCodeDoesNotExist() {
            Optional<Line> result = repository.findByCode("Z9");

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("code search is case-sensitive")
        void codSearchIsCaseSensitive() {
            Optional<Line> result = repository.findByCode("m1");

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("existsByCode")
    class ExistsByCode {

        @Test
        @DisplayName("returns true when code exists")
        void returnsTrueWhenExists() {
            boolean result = repository.existsByCode("B2");

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("returns false when code does not exist")
        void returnsFalseWhenDoesNotExist() {
            boolean result = repository.existsByCode("Z9");

            assertThat(result).isFalse();
        }
    }

    @Nested
    @DisplayName("findByIdWithStopsAndRoutes")
    class FindByIdWithStopsAndRoutes {

        @Test
        @DisplayName("returns line with eagerly loaded stops and itineraries")
        void returnsLineWithEagerAssociations() {
            Optional<Line> result = repository.findByIdWithStopsAndRoutes(lineM1.getId());

            assertThat(result).isPresent();
            Line line = result.get();
            assertThat(line.getCode()).isEqualTo("M1");
            assertThat(line.getStops()).hasSize(2);
            assertThat(line.getItineraries()).hasSize(1);
            Set<String> stopNames = line.getStops().stream()
                    .map(Stop::getName)
                    .collect(Collectors.toSet());
            assertThat(stopNames).containsExactlyInAnyOrder("Station Alpha", "Station Beta");
        }

        @Test
        @DisplayName("returns empty optional for non-existent id")
        void returnsEmptyForNonExistentId() {
            Optional<Line> result = repository.findByIdWithStopsAndRoutes(UUID.randomUUID());

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns line with empty stops and itineraries when none are associated")
        void returnsLineWithEmptyAssociations() {
            Optional<Line> result = repository.findByIdWithStopsAndRoutes(lineT3.getId());

            assertThat(result).isPresent();
            assertThat(result.get().getStops()).isEmpty();
            assertThat(result.get().getItineraries()).isEmpty();
        }
    }

    @Nested
    @DisplayName("findAllWithStopsAndRoutes")
    class FindAllWithStopsAndRoutes {

        @Test
        @DisplayName("returns all lines ordered by code with stops and itineraries")
        void returnsAllLinesOrderedByCode() {
            List<Line> result = repository.findAllWithStopsAndRoutes();

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getCode()).isEqualTo("B2");
            assertThat(result.get(1).getCode()).isEqualTo("M1");
            assertThat(result.get(2).getCode()).isEqualTo("T3");
        }

        @Test
        @DisplayName("eagerly loads stops and itineraries")
        void eagerlyLoadsAssociations() {
            List<Line> result = repository.findAllWithStopsAndRoutes();

            Line m1 = result.stream()
                    .filter(l -> l.getCode().equals("M1"))
                    .findFirst().orElseThrow();
            assertThat(m1.getStops()).hasSize(2);
            assertThat(m1.getItineraries()).hasSize(1);
        }

        @Test
        @DisplayName("returns distinct lines even with multiple associations")
        void returnsDistinctLines() {
            List<Line> result = repository.findAllWithStopsAndRoutes();

            long m1Count = result.stream().filter(l -> l.getCode().equals("M1")).count();
            assertThat(m1Count).isEqualTo(1);
        }
    }

    @Nested
    @DisplayName("findAllWithItineraryStops")
    class FindAllWithItineraryStops {

        @Test
        @DisplayName("deep fetches itineraries with their itinerary stops and stops")
        void deepFetchesItineraryStops() {
            List<Line> result = repository.findAllWithItineraryStops();

            Line m1 = result.stream()
                    .filter(l -> l.getCode().equals("M1"))
                    .findFirst().orElseThrow();
            assertThat(m1.getItineraries()).hasSize(1);
            Itinerary itinerary = m1.getItineraries().iterator().next();
            assertThat(itinerary.getItineraryStops()).hasSize(2);
            assertThat(itinerary.getItineraryStops().get(0).getStop().getName()).isNotBlank();
        }

        @Test
        @DisplayName("returns lines ordered by code")
        void returnsLinesOrderedByCode() {
            List<Line> result = repository.findAllWithItineraryStops();

            List<String> codes = result.stream().map(Line::getCode).toList();
            assertThat(codes).isSorted();
        }
    }

    @Nested
    @DisplayName("findBySearchWithStopsAndRoutes")
    class FindBySearchWithStopsAndRoutes {

        @Test
        @DisplayName("searches by code case-insensitively")
        void searchesByCode() {
            Page<Line> result = repository.findBySearchWithStopsAndRoutes(
                    "m1", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getCode()).isEqualTo("M1");
            assertThat(result.getContent().getFirst().getStops()).hasSize(2);
        }

        @Test
        @DisplayName("searches by name case-insensitively")
        void searchesByName() {
            Page<Line> result = repository.findBySearchWithStopsAndRoutes(
                    "bus", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getCode()).isEqualTo("B2");
        }

        @Test
        @DisplayName("searches by partial match on code or name")
        void searchesByPartialMatch() {
            Page<Line> result = repository.findBySearchWithStopsAndRoutes(
                    "line", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(3);
        }

        @Test
        @DisplayName("returns empty page when no match")
        void returnsEmptyWhenNoMatch() {
            Page<Line> result = repository.findBySearchWithStopsAndRoutes(
                    "nonexistent", PageRequest.of(0, 10));

            assertThat(result.getContent()).isEmpty();
            assertThat(result.getTotalElements()).isZero();
        }
    }

    @Nested
    @DisplayName("findAllWithStopsAndRoutes (paginated)")
    class FindAllWithStopsAndRoutesPaginated {

        @Test
        @DisplayName("returns paginated results with stops and itineraries")
        void returnsPaginatedResults() {
            Page<Line> result = repository.findAllWithStopsAndRoutes(PageRequest.of(0, 2));

            assertThat(result.getContent()).hasSize(2);
            assertThat(result.getTotalElements()).isEqualTo(3);
            assertThat(result.getTotalPages()).isEqualTo(2);
        }

        @Test
        @DisplayName("second page contains remaining lines")
        void secondPageContainsRemaining() {
            Page<Line> result = repository.findAllWithStopsAndRoutes(PageRequest.of(1, 2));

            assertThat(result.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("findBySearch")
    class FindBySearch {

        @Test
        @DisplayName("searches by code or name")
        void searchesByCodeOrName() {
            Page<Line> result = repository.findBySearch("metro", PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getContent().getFirst().getCode()).isEqualTo("M1");
        }

        @Test
        @DisplayName("returns empty page when no match")
        void returnsEmptyWhenNoMatch() {
            Page<Line> result = repository.findBySearch("xyz", PageRequest.of(0, 10));

            assertThat(result.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("findAll (paginated)")
    class FindAllPaginated {

        @Test
        @DisplayName("returns all lines paginated")
        void returnsAllLinesPaginated() {
            Page<Line> result = repository.findAll(PageRequest.of(0, 10));

            assertThat(result.getContent()).hasSize(3);
            assertThat(result.getTotalElements()).isEqualTo(3);
        }

        @Test
        @DisplayName("respects page size")
        void respectsPageSize() {
            Page<Line> result = repository.findAll(PageRequest.of(0, 1));

            assertThat(result.getContent()).hasSize(1);
            assertThat(result.getTotalPages()).isEqualTo(3);
        }
    }
}
