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
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.cache.autoconfigure.CacheAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Execution(ExecutionMode.SAME_THREAD)
@DataJpaTest
@ImportAutoConfiguration(CacheAutoConfiguration.class)
@ActiveProfiles("test")
@DisplayName("ItineraryStopRepository")
class ItineraryStopRepositoryTest {

    @Autowired
    private ItineraryStopRepository repository;

    @Autowired
    private TestEntityManager em;

    private Line line;
    private Stop stopAlpha;
    private Stop stopBeta;
    private Stop stopGamma;
    private Itinerary itinerary1;
    private Itinerary itinerary2;
    private ItineraryStop is1;
    private ItineraryStop is2;
    private ItineraryStop is3;
    private ItineraryStop is4;

    @BeforeEach
    void setUp() {
        line = Line.builder()
                .code("M1")
                .name("Metro Line 1")
                .color("#FF0000")
                .type(LineType.METRO)
                .build();
        em.persist(line);

        stopAlpha = Stop.builder().name("Station Alpha").build();
        stopAlpha.addLine(line);
        em.persist(stopAlpha);

        stopBeta = Stop.builder().name("Station Beta").build();
        stopBeta.addLine(line);
        em.persist(stopBeta);

        stopGamma = Stop.builder().name("Station Gamma").build();
        stopGamma.addLine(line);
        em.persist(stopGamma);

        itinerary1 = Itinerary.builder()
                .line(line)
                .name("Alpha to Gamma")
                .build();
        em.persist(itinerary1);

        is1 = ItineraryStop.builder()
                .itinerary(itinerary1)
                .stop(stopAlpha)
                .position(0)
                .build();
        em.persist(is1);

        is2 = ItineraryStop.builder()
                .itinerary(itinerary1)
                .stop(stopBeta)
                .position(1)
                .build();
        em.persist(is2);

        is3 = ItineraryStop.builder()
                .itinerary(itinerary1)
                .stop(stopGamma)
                .position(2)
                .build();
        em.persist(is3);

        itinerary2 = Itinerary.builder()
                .line(line)
                .name("Gamma to Alpha")
                .build();
        em.persist(itinerary2);

        is4 = ItineraryStop.builder()
                .itinerary(itinerary2)
                .stop(stopGamma)
                .position(0)
                .build();
        em.persist(is4);

        em.flush();
        em.clear();
    }

    @Nested
    @DisplayName("findByItineraryIdOrderByPosition")
    class FindByItineraryIdOrderByPosition {

        @Test
        @DisplayName("returns itinerary stops ordered by position")
        void returnsStopsOrderedByPosition() {
            List<ItineraryStop> result = repository.findByItineraryIdOrderByPosition(itinerary1.getId());

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getPosition()).isZero();
            assertThat(result.get(1).getPosition()).isEqualTo(1);
            assertThat(result.get(2).getPosition()).isEqualTo(2);
        }

        @Test
        @DisplayName("returns only stops for the given itinerary")
        void returnsOnlyStopsForGivenItinerary() {
            List<ItineraryStop> result = repository.findByItineraryIdOrderByPosition(itinerary2.getId());

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getPosition()).isZero();
        }

        @Test
        @DisplayName("returns empty list for non-existent itinerary")
        void returnsEmptyForNonExistentItinerary() {
            List<ItineraryStop> result = repository.findByItineraryIdOrderByPosition(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByItineraryIdWithStopOrderByPosition")
    class FindByItineraryIdWithStopOrderByPosition {

        @Test
        @DisplayName("returns itinerary stops with stop eagerly loaded, ordered by position")
        void returnsStopsWithEagerStop() {
            List<ItineraryStop> result = repository.findByItineraryIdWithStopOrderByPosition(itinerary1.getId());

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getStop().getName()).isEqualTo("Station Alpha");
            assertThat(result.get(1).getStop().getName()).isEqualTo("Station Beta");
            assertThat(result.get(2).getStop().getName()).isEqualTo("Station Gamma");
        }

        @Test
        @DisplayName("returns empty list for non-existent itinerary")
        void returnsEmptyForNonExistentItinerary() {
            List<ItineraryStop> result = repository.findByItineraryIdWithStopOrderByPosition(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("existsByItineraryIdAndStopId")
    class ExistsByItineraryIdAndStopId {

        @Test
        @DisplayName("returns true when itinerary contains the stop")
        void returnsTrueWhenExists() {
            boolean result = repository.existsByItineraryIdAndStopId(itinerary1.getId(), stopAlpha.getId());

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("returns false when itinerary does not contain the stop")
        void returnsFalseWhenDoesNotExist() {
            boolean result = repository.existsByItineraryIdAndStopId(itinerary2.getId(), stopAlpha.getId());

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("returns false for non-existent itinerary")
        void returnsFalseForNonExistentItinerary() {
            boolean result = repository.existsByItineraryIdAndStopId(UUID.randomUUID(), stopAlpha.getId());

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("returns false for non-existent stop")
        void returnsFalseForNonExistentStop() {
            boolean result = repository.existsByItineraryIdAndStopId(itinerary1.getId(), UUID.randomUUID());

            assertThat(result).isFalse();
        }
    }

    @Nested
    @DisplayName("deleteByItineraryId")
    class DeleteByItineraryId {

        @Test
        @DisplayName("deletes all itinerary stops for the given itinerary")
        void deletesAllStopsForItinerary() {
            em.flush();
            em.clear();

            repository.deleteByItineraryId(itinerary1.getId());
            em.flush();
            em.clear();

            List<ItineraryStop> remaining = repository.findByItineraryIdOrderByPosition(itinerary1.getId());
            assertThat(remaining).isEmpty();

            // Other itinerary's stops remain
            List<ItineraryStop> itinerary2Stops = repository.findByItineraryIdOrderByPosition(itinerary2.getId());
            assertThat(itinerary2Stops).hasSize(1);
        }

        @Test
        @DisplayName("does nothing when itinerary has no stops")
        void doesNothingWhenNoStops() {
            Itinerary emptyItinerary = Itinerary.builder()
                    .line(line)
                    .name("Empty Itinerary")
                    .build();
            em.persistAndFlush(emptyItinerary);
            em.clear();

            long countBefore = repository.count();

            repository.deleteByItineraryId(emptyItinerary.getId());
            em.flush();
            em.clear();

            assertThat(repository.count()).isEqualTo(countBefore);
        }
    }

    @Nested
    @DisplayName("deleteByStopId")
    class DeleteByStopId {

        @Test
        @DisplayName("deletes all itinerary stops referencing the given stop")
        void deletesAllStopsReferencingStop() {
            em.flush();
            em.clear();

            // stopAlpha appears in itinerary1 at position 0
            repository.deleteByStopId(stopAlpha.getId());
            em.flush();
            em.clear();

            List<ItineraryStop> itinerary1Stops = repository.findByItineraryIdOrderByPosition(itinerary1.getId());
            assertThat(itinerary1Stops).hasSize(2);
            assertThat(itinerary1Stops).noneMatch(is -> is.getStop().getId().equals(stopAlpha.getId()));
        }

        @Test
        @DisplayName("deletes from multiple itineraries when stop is shared")
        void deletesFromMultipleItineraries() {
            // Add stopGamma to a position in itinerary1 - but it is already there at position 2
            // stopGamma is in both itinerary1 (position 2) and itinerary2 (position 0)
            em.flush();
            em.clear();

            repository.deleteByStopId(stopGamma.getId());
            em.flush();
            em.clear();

            List<ItineraryStop> it1Stops = repository.findByItineraryIdOrderByPosition(itinerary1.getId());
            List<ItineraryStop> it2Stops = repository.findByItineraryIdOrderByPosition(itinerary2.getId());

            assertThat(it1Stops).hasSize(2); // Alpha and Beta remain
            assertThat(it2Stops).isEmpty(); // Gamma was the only stop
        }
    }

    @Nested
    @DisplayName("findMaxPositionByItineraryId")
    class FindMaxPositionByItineraryId {

        @Test
        @DisplayName("returns the maximum position for the given itinerary")
        void returnsMaxPosition() {
            Integer result = repository.findMaxPositionByItineraryId(itinerary1.getId());

            assertThat(result).isEqualTo(2);
        }

        @Test
        @DisplayName("returns 0 for itinerary with single stop")
        void returnsZeroForSingleStop() {
            Integer result = repository.findMaxPositionByItineraryId(itinerary2.getId());

            assertThat(result).isZero();
        }

        @Test
        @DisplayName("returns null for itinerary with no stops")
        void returnsNullForEmptyItinerary() {
            Itinerary emptyItinerary = Itinerary.builder()
                    .line(line)
                    .name("Empty Itinerary")
                    .build();
            em.persistAndFlush(emptyItinerary);
            em.clear();

            Integer result = repository.findMaxPositionByItineraryId(emptyItinerary.getId());

            assertThat(result).isNull();
        }

        @Test
        @DisplayName("returns null for non-existent itinerary")
        void returnsNullForNonExistentItinerary() {
            Integer result = repository.findMaxPositionByItineraryId(UUID.randomUUID());

            assertThat(result).isNull();
        }
    }
}
