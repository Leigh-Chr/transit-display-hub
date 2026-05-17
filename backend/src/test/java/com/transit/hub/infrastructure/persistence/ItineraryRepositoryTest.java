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
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@Execution(ExecutionMode.SAME_THREAD)
@DataJpaTest
@ImportAutoConfiguration(CacheAutoConfiguration.class)
@ActiveProfiles("test")
@DisplayName("ItineraryRepository")
class ItineraryRepositoryTest {

    @Autowired
    private ItineraryRepository repository;

    @Autowired
    private TestEntityManager em;

    private Line lineM1;
    private Line lineB2;
    private Stop stopAlpha;
    private Stop stopBeta;
    private Stop stopGamma;
    private Itinerary itineraryForward;
    private Itinerary itineraryReverse;
    private Itinerary itineraryBus;

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

        stopAlpha = Stop.builder().name("Station Alpha").build();
        stopAlpha.addLine(lineM1);
        em.persist(stopAlpha);

        stopBeta = Stop.builder().name("Station Beta").build();
        stopBeta.addLine(lineM1);
        em.persist(stopBeta);

        stopGamma = Stop.builder().name("Station Gamma").build();
        stopGamma.addLine(lineB2);
        em.persist(stopGamma);

        itineraryForward = Itinerary.builder()
                .line(lineM1)
                .name("Alpha to Beta")
                .build();
        em.persist(itineraryForward);

        ItineraryStop is1 = ItineraryStop.builder()
                .itinerary(itineraryForward)
                .stop(stopAlpha)
                .position(0)
                .build();
        em.persist(is1);

        ItineraryStop is2 = ItineraryStop.builder()
                .itinerary(itineraryForward)
                .stop(stopBeta)
                .position(1)
                .build();
        em.persist(is2);

        itineraryReverse = Itinerary.builder()
                .line(lineM1)
                .name("Beta to Alpha")
                .build();
        em.persist(itineraryReverse);

        ItineraryStop is3 = ItineraryStop.builder()
                .itinerary(itineraryReverse)
                .stop(stopBeta)
                .position(0)
                .build();
        em.persist(is3);

        ItineraryStop is4 = ItineraryStop.builder()
                .itinerary(itineraryReverse)
                .stop(stopAlpha)
                .position(1)
                .build();
        em.persist(is4);

        itineraryBus = Itinerary.builder()
                .line(lineB2)
                .name("Gamma Loop")
                .build();
        em.persist(itineraryBus);

        ItineraryStop is5 = ItineraryStop.builder()
                .itinerary(itineraryBus)
                .stop(stopGamma)
                .position(0)
                .build();
        em.persist(is5);

        em.flush();
        em.clear();
    }

    @Nested
    @DisplayName("findAllWithLineAndStops")
    class FindAllWithLineAndStops {

        @Test
        @DisplayName("returns all itineraries with line and stops ordered by line code then name")
        void returnsAllOrderedByLineCodeThenName() {
            List<Itinerary> result = repository.findAllWithLineAndStops();

            assertThat(result).hasSize(3);
            // B2 comes before M1, and within M1: "Alpha to Beta" before "Beta to Alpha"
            assertThat(result.get(0).getLine().getCode()).isEqualTo("B2");
            assertThat(result.get(0).getName()).isEqualTo("Gamma Loop");
            assertThat(result.get(1).getLine().getCode()).isEqualTo("M1");
            assertThat(result.get(1).getName()).isEqualTo("Alpha to Beta");
            assertThat(result.get(2).getLine().getCode()).isEqualTo("M1");
            assertThat(result.get(2).getName()).isEqualTo("Beta to Alpha");
        }

        @Test
        @DisplayName("eagerly loads line, itinerary stops, and their stops")
        void eagerlyLoadsAssociations() {
            List<Itinerary> result = repository.findAllWithLineAndStops();

            Itinerary forward = result.stream()
                    .filter(i -> i.getName().equals("Alpha to Beta"))
                    .findFirst().orElseThrow();
            assertThat(forward.getLine().getCode()).isEqualTo("M1");
            assertThat(forward.getItineraryStops()).hasSize(2);
            assertThat(forward.getItineraryStops().get(0).getStop().getName()).isEqualTo("Station Alpha");
            assertThat(forward.getItineraryStops().get(1).getStop().getName()).isEqualTo("Station Beta");
        }
    }

    @Nested
    @DisplayName("findByIdWithLineAndStops")
    class FindByIdWithLineAndStops {

        @Test
        @DisplayName("returns itinerary with line and stops eagerly loaded")
        void returnsItineraryWithAssociations() {
            Optional<Itinerary> result = repository.findByIdWithLineAndStops(itineraryForward.getId());

            assertThat(result).isPresent();
            Itinerary itinerary = result.get();
            assertThat(itinerary.getName()).isEqualTo("Alpha to Beta");
            assertThat(itinerary.getLine().getCode()).isEqualTo("M1");
            assertThat(itinerary.getItineraryStops()).hasSize(2);
            assertThat(itinerary.getItineraryStops().get(0).getStop().getName()).isEqualTo("Station Alpha");
        }

        @Test
        @DisplayName("returns empty optional for non-existent id")
        void returnsEmptyForNonExistentId() {
            Optional<Itinerary> result = repository.findByIdWithLineAndStops(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByIdWithLine")
    class FindByIdWithLine {

        @Test
        @DisplayName("returns itinerary with line eagerly loaded")
        void returnsItineraryWithLine() {
            Optional<Itinerary> result = repository.findByIdWithLine(itineraryBus.getId());

            assertThat(result).isPresent();
            assertThat(result.get().getName()).isEqualTo("Gamma Loop");
            assertThat(result.get().getLine().getCode()).isEqualTo("B2");
        }

        @Test
        @DisplayName("returns empty optional for non-existent id")
        void returnsEmptyForNonExistentId() {
            Optional<Itinerary> result = repository.findByIdWithLine(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByLineIdWithLineAndStops")
    class FindByLineIdWithLineAndStops {

        @Test
        @DisplayName("returns itineraries for the given line ordered by name")
        void returnsItinerariesForLineOrderedByName() {
            List<Itinerary> result = repository.findByLineIdWithLineAndStops(lineM1.getId());

            assertThat(result).hasSize(2);
            assertThat(result.get(0).getName()).isEqualTo("Alpha to Beta");
            assertThat(result.get(1).getName()).isEqualTo("Beta to Alpha");
        }

        @Test
        @DisplayName("eagerly loads line and stops")
        void eagerlyLoadsAssociations() {
            List<Itinerary> result = repository.findByLineIdWithLineAndStops(lineM1.getId());

            assertThat(result.getFirst().getLine().getCode()).isEqualTo("M1");
            assertThat(result.getFirst().getItineraryStops()).hasSize(2);
            assertThat(result.getFirst().getItineraryStops().get(0).getStop().getName()).isNotBlank();
        }

        @Test
        @DisplayName("returns empty list for non-existent line id")
        void returnsEmptyForNonExistentLine() {
            List<Itinerary> result = repository.findByLineIdWithLineAndStops(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("existsByLineIdAndName")
    class ExistsByLineIdAndName {

        @Test
        @DisplayName("returns true when itinerary with line and name exists")
        void returnsTrueWhenExists() {
            boolean result = repository.existsByLineIdAndName(lineM1.getId(), "Alpha to Beta");

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("returns false when name does not exist for the line")
        void returnsFalseWhenNameDoesNotExist() {
            boolean result = repository.existsByLineIdAndName(lineM1.getId(), "Nonexistent");

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("returns false when name exists but for a different line")
        void returnsFalseWhenDifferentLine() {
            boolean result = repository.existsByLineIdAndName(lineB2.getId(), "Alpha to Beta");

            assertThat(result).isFalse();
        }
    }

    @Nested
    @DisplayName("existsByLineIdAndNameExcludingId")
    class ExistsByLineIdAndNameExcludingId {

        @Test
        @DisplayName("returns false when the only match is the excluded itinerary")
        void returnsFalseWhenExcludedIsOnlyMatch() {
            boolean result = repository.existsByLineIdAndNameExcludingId(
                    lineM1.getId(), "Alpha to Beta", itineraryForward.getId());

            assertThat(result).isFalse();
        }

        @Test
        @DisplayName("returns true when another itinerary has the same line and name")
        void returnsTrueWhenDuplicateExists() {
            // Create a second itinerary with a different name, then check a different exclusion
            boolean result = repository.existsByLineIdAndNameExcludingId(
                    lineM1.getId(), "Alpha to Beta", itineraryReverse.getId());

            assertThat(result).isTrue();
        }

        @Test
        @DisplayName("returns false when name does not exist for the line")
        void returnsFalseWhenNoMatch() {
            boolean result = repository.existsByLineIdAndNameExcludingId(
                    lineM1.getId(), "Nonexistent", itineraryForward.getId());

            assertThat(result).isFalse();
        }
    }

    @Nested
    @DisplayName("findByLineId")
    class FindByLineId {

        @Test
        @DisplayName("returns itineraries for the given line")
        void returnsItinerariesForLine() {
            List<Itinerary> result = repository.findByLineId(lineM1.getId());

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("returns empty list for line with no itineraries")
        void returnsEmptyForLineWithNoItineraries() {
            Line emptyLine = Line.builder()
                    .code("T1")
                    .name("Tram Line 1")
                    .color("#FFFF00")
                    .type(LineType.TRAM)
                    .build();
            em.persistAndFlush(emptyLine);
            em.clear();

            List<Itinerary> result = repository.findByLineId(emptyLine.getId());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("deleteByLineId")
    class DeleteByLineId {

        @Test
        @DisplayName("deletes all itineraries for the given line")
        void deletesAllItinerariesForLine() {
            em.flush();
            em.clear();

            repository.deleteByLineId(lineB2.getId());
            em.flush();
            em.clear();

            List<Itinerary> remaining = repository.findByLineId(lineB2.getId());
            assertThat(remaining).isEmpty();

            // Other line's itineraries remain
            List<Itinerary> m1Itineraries = repository.findByLineId(lineM1.getId());
            assertThat(m1Itineraries).hasSize(2);
        }

        @Test
        @DisplayName("does nothing when line has no itineraries")
        void doesNothingWhenNoItineraries() {
            Line emptyLine = Line.builder()
                    .code("T1")
                    .name("Tram Line 1")
                    .color("#FFFF00")
                    .type(LineType.TRAM)
                    .build();
            em.persistAndFlush(emptyLine);
            em.clear();

            repository.deleteByLineId(emptyLine.getId());
            em.flush();
            em.clear();

            // Total count should be unchanged
            assertThat(repository.count()).isEqualTo(3);
        }
    }

    @Nested
    @DisplayName("findAllIds + findAllByIdInWithLine (two-step pagination)")
    class FindAllPaginatedTwoStep {

        @Test
        @DisplayName("first page returns ids that hydrate with line + itineraryStops")
        void returnsPaginatedWithLine() {
            Page<UUID> idsPage = repository.findAllIds(PageRequest.of(0, 2));
            List<Itinerary> hydrated = repository.findAllByIdInWithLine(idsPage.getContent());

            assertThat(idsPage.getContent()).hasSize(2);
            assertThat(idsPage.getTotalElements()).isEqualTo(3);
            assertThat(idsPage.getTotalPages()).isEqualTo(2);
            assertThat(hydrated).hasSize(2);
            assertThat(hydrated.getFirst().getLine().getCode()).isNotBlank();
        }

        @Test
        @DisplayName("second page contains the remaining itinerary")
        void secondPageContainsRemaining() {
            Page<UUID> idsPage = repository.findAllIds(PageRequest.of(1, 2));

            assertThat(idsPage.getContent()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("findIdsByLineId (paginated)")
    class FindIdsByLineId {

        @Test
        @DisplayName("returns paginated itinerary ids for a specific line")
        void returnsPaginatedForLine() {
            Page<UUID> idsPage = repository.findIdsByLineId(
                    lineM1.getId(), PageRequest.of(0, 1));

            assertThat(idsPage.getContent()).hasSize(1);
            assertThat(idsPage.getTotalElements()).isEqualTo(2);
            assertThat(idsPage.getTotalPages()).isEqualTo(2);
        }

        @Test
        @DisplayName("returns empty page for non-existent line")
        void returnsEmptyForNonExistentLine() {
            Page<UUID> idsPage = repository.findIdsByLineId(
                    UUID.randomUUID(), PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).isEmpty();
            assertThat(idsPage.getTotalElements()).isZero();
        }
    }

    @Nested
    @DisplayName("findIdsBySearch")
    class FindIdsBySearch {

        @Test
        @DisplayName("finds itineraries by name case-insensitively")
        void findsByNameCaseInsensitive() {
            Page<UUID> idsPage = repository.findIdsBySearch(
                    "alpha", PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).hasSize(2);
        }

        @Test
        @DisplayName("finds itineraries by partial name match")
        void findsByPartialName() {
            Page<UUID> idsPage = repository.findIdsBySearch(
                    "loop", PageRequest.of(0, 10));
            List<Itinerary> hydrated = repository.findAllByIdInWithLine(idsPage.getContent());

            assertThat(hydrated).hasSize(1);
            assertThat(hydrated.getFirst().getName()).isEqualTo("Gamma Loop");
        }

        @Test
        @DisplayName("returns empty page when no match")
        void returnsEmptyWhenNoMatch() {
            Page<UUID> idsPage = repository.findIdsBySearch(
                    "nonexistent", PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).isEmpty();
        }
    }

    @Nested
    @DisplayName("findIdsByLineIdAndSearch")
    class FindIdsByLineIdAndSearch {

        @Test
        @DisplayName("filters by both line and search term")
        void filtersByLineAndSearch() {
            Page<UUID> idsPage = repository.findIdsByLineIdAndSearch(
                    lineM1.getId(), "alpha", PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).hasSize(2);
        }

        @Test
        @DisplayName("returns empty when search matches but line does not")
        void returnsEmptyWhenLineDoesNotMatch() {
            Page<UUID> idsPage = repository.findIdsByLineIdAndSearch(
                    lineB2.getId(), "alpha", PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).isEmpty();
        }

        @Test
        @DisplayName("returns empty when line matches but search does not")
        void returnsEmptyWhenSearchDoesNotMatch() {
            Page<UUID> idsPage = repository.findIdsByLineIdAndSearch(
                    lineM1.getId(), "nonexistent", PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).isEmpty();
        }

        @Test
        @DisplayName("respects pagination")
        void respectsPagination() {
            Page<UUID> idsPage = repository.findIdsByLineIdAndSearch(
                    lineM1.getId(), "alpha", PageRequest.of(0, 1));

            assertThat(idsPage.getContent()).hasSize(1);
            assertThat(idsPage.getTotalElements()).isEqualTo(2);
            assertThat(idsPage.getTotalPages()).isEqualTo(2);
        }
    }
}
