package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.DeviceStatus;
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
@DisplayName("StopRepository")
class StopRepositoryTest {

    @Autowired
    private StopRepository repository;

    @Autowired
    private TestEntityManager em;

    private Line lineM1;
    private Line lineB2;
    private Stop stopCentral;
    private Stop stopNorth;
    private Stop stopSouth;
    private Device deviceCentral;

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

        stopCentral = Stop.builder().name("Central Station").build();
        stopCentral.addLine(lineM1);
        stopCentral.addLine(lineB2);
        em.persist(stopCentral);

        stopNorth = Stop.builder().name("North Station").build();
        stopNorth.addLine(lineM1);
        em.persist(stopNorth);

        stopSouth = Stop.builder().name("South Station").build();
        stopSouth.addLine(lineB2);
        em.persist(stopSouth);

        deviceCentral = Device.builder()
                .stop(stopCentral)
                .status(DeviceStatus.ONLINE)
                .tokenLookup("cent0001")
                .tokenHash("hash_central_1")
                .build();
        em.persist(deviceCentral);

        em.flush();
        em.clear();
    }

    @Nested
    @DisplayName("findAllWithLinesAndDevices")
    class FindAllWithLinesAndDevices {

        @Test
        @DisplayName("returns all stops with eagerly loaded lines and devices")
        void returnsAllStopsWithEagerAssociations() {
            List<Stop> result = repository.findAllWithLinesAndDevices();

            assertThat(result).hasSize(3);
            Stop central = result.stream()
                    .filter(s -> s.getName().equals("Central Station"))
                    .findFirst().orElseThrow();
            assertThat(central.getLines()).hasSize(2);
            // Devices are loaded (accessible without LazyInitializationException)
            Set<UUID> deviceIds = central.getDevices().stream()
                    .map(Device::getId)
                    .collect(Collectors.toSet());
            assertThat(deviceIds).containsExactly(deviceCentral.getId());
        }

        @Test
        @DisplayName("returns distinct stops even when stop has multiple lines")
        void returnsDistinctStops() {
            List<Stop> result = repository.findAllWithLinesAndDevices();

            long centralCount = result.stream()
                    .filter(s -> s.getName().equals("Central Station"))
                    .count();
            assertThat(centralCount).isEqualTo(1);
        }

        @Test
        @DisplayName("returns empty list for non-existent line id")
        void returnsEmptyForNonExistentLine() {
            List<Stop> result = repository.findByLineIdWithLinesAndDevices(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findAllWithLines")
    class FindAllWithLines {

        @Test
        @DisplayName("returns all stops ordered by name with eagerly loaded lines")
        void returnsAllStopsOrderedByName() {
            List<Stop> result = repository.findAllWithLines();

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getName()).isEqualTo("Central Station");
            assertThat(result.get(1).getName()).isEqualTo("North Station");
            assertThat(result.get(2).getName()).isEqualTo("South Station");
            assertThat(result.get(0).getLines()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("findByIdWithLinesAndDevices")
    class FindByIdWithLinesAndDevices {

        @Test
        @DisplayName("returns stop with eagerly loaded lines and devices")
        void returnsStopWithAssociations() {
            Optional<Stop> result = repository.findByIdWithLinesAndDevices(stopCentral.getId());

            assertThat(result).isPresent();
            Stop stop = result.get();
            assertThat(stop.getName()).isEqualTo("Central Station");
            assertThat(stop.getLines()).hasSize(2);
            Set<UUID> deviceIds = stop.getDevices().stream()
                    .map(Device::getId)
                    .collect(Collectors.toSet());
            assertThat(deviceIds).containsExactly(deviceCentral.getId());
        }

        @Test
        @DisplayName("returns empty optional for non-existent id")
        void returnsEmptyForNonExistentId() {
            Optional<Stop> result = repository.findByIdWithLinesAndDevices(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByIdWithLines")
    class FindByIdWithLines {

        @Test
        @DisplayName("returns stop with eagerly loaded lines")
        void returnsStopWithLines() {
            Optional<Stop> result = repository.findByIdWithLines(stopNorth.getId());

            assertThat(result).isPresent();
            Stop stop = result.get();
            assertThat(stop.getName()).isEqualTo("North Station");
            assertThat(stop.getLines()).hasSize(1);
            Set<String> lineCodes = stop.getLines().stream()
                    .map(Line::getCode)
                    .collect(Collectors.toSet());
            assertThat(lineCodes).containsExactly("M1");
        }

        @Test
        @DisplayName("returns empty optional for non-existent id")
        void returnsEmptyForNonExistentId() {
            Optional<Stop> result = repository.findByIdWithLines(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByLineId")
    class FindByLineId {

        @Test
        @DisplayName("returns stops belonging to the given line")
        void returnsStopsForLine() {
            List<Stop> result = repository.findByLineId(lineM1.getId());

            assertThat(result).hasSize(2);
            Set<String> names = result.stream().map(Stop::getName).collect(Collectors.toSet());
            assertThat(names).containsExactlyInAnyOrder("Central Station", "North Station");
        }

        @Test
        @DisplayName("returns empty list for line with no stops")
        void returnsEmptyForLineWithNoStops() {
            Line emptyLine = Line.builder()
                    .code("T1")
                    .name("Tram Line 1")
                    .color("#0000FF")
                    .type(LineType.TRAM)
                    .build();
            em.persistAndFlush(emptyLine);
            em.clear();

            List<Stop> result = repository.findByLineId(emptyLine.getId());

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty list for non-existent line id")
        void returnsEmptyForNonExistentLine() {
            List<Stop> result = repository.findByLineId(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByLineIdWithLinesAndDevices")
    class FindByLineIdWithLinesAndDevices {

        @Test
        @DisplayName("returns stops for line with all lines and devices eagerly loaded")
        void returnsStopsWithEagerAssociations() {
            List<Stop> result = repository.findByLineIdWithLinesAndDevices(lineM1.getId());

            assertThat(result).hasSize(2);
            Stop central = result.stream()
                    .filter(s -> s.getName().equals("Central Station"))
                    .findFirst().orElseThrow();
            // Central Station belongs to both M1 and B2 - all lines should be fetched
            assertThat(central.getLines()).hasSize(2);
            Set<UUID> deviceIds = central.getDevices().stream()
                    .map(Device::getId)
                    .collect(Collectors.toSet());
            assertThat(deviceIds).containsExactly(deviceCentral.getId());
        }
    }

    @Nested
    @DisplayName("findByLineIdWithLines")
    class FindByLineIdWithLines {

        @Test
        @DisplayName("returns stops for line with all lines eagerly loaded")
        void returnsStopsWithLines() {
            List<Stop> result = repository.findByLineIdWithLines(lineB2.getId());

            assertThat(result).hasSize(2);
            Set<String> names = result.stream().map(Stop::getName).collect(Collectors.toSet());
            assertThat(names).containsExactlyInAnyOrder("Central Station", "South Station");
            // Central has both lines loaded
            Stop central = result.stream()
                    .filter(s -> s.getName().equals("Central Station"))
                    .findFirst().orElseThrow();
            assertThat(central.getLines()).hasSize(2);
        }
    }

    @Nested
    @DisplayName("findAllIds")
    class FindAllIds {

        @Test
        @DisplayName("returns set of all stop ids")
        void returnsAllIds() {
            Set<UUID> result = repository.findAllIds();

            assertThat(result).hasSize(3);
            assertThat(result).containsExactlyInAnyOrder(
                    stopCentral.getId(), stopNorth.getId(), stopSouth.getId());
        }

        @Test
        @DisplayName("returns empty set for non-existent line id query")
        void returnsEmptyForNonExistentLineQuery() {
            List<Stop> result = repository.findByLineId(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findIdsBySearch + findAllByIdInWithLinesAndDevices (two-step pagination)")
    class FindBySearchTwoStep {

        @Test
        @DisplayName("finds stops matching search term case-insensitively")
        void findsByCaseInsensitiveSearch() {
            Page<UUID> idsPage = repository.findIdsBySearch("central", PageRequest.of(0, 10));
            List<Stop> hydrated = repository.findAllByIdInWithLinesAndDevices(idsPage.getContent());

            assertThat(hydrated).hasSize(1);
            assertThat(hydrated.getFirst().getName()).isEqualTo("Central Station");
            assertThat(hydrated.getFirst().getLines()).hasSize(2);
            Set<UUID> deviceIds = hydrated.getFirst().getDevices().stream()
                    .map(Device::getId)
                    .collect(Collectors.toSet());
            assertThat(deviceIds).containsExactly(deviceCentral.getId());
        }

        @Test
        @DisplayName("finds stops by partial name match")
        void findsByPartialMatch() {
            Page<UUID> idsPage = repository.findIdsBySearch("station", PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).hasSize(3);
            assertThat(idsPage.getTotalElements()).isEqualTo(3);
        }

        @Test
        @DisplayName("returns empty page when no stops match")
        void returnsEmptyWhenNoMatch() {
            Page<UUID> idsPage = repository.findIdsBySearch("nonexistent", PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).isEmpty();
            assertThat(idsPage.getTotalElements()).isZero();
        }

        @Test
        @DisplayName("respects pagination on the id query")
        void respectsPagination() {
            Page<UUID> page0 = repository.findIdsBySearch("station", PageRequest.of(0, 2));
            Page<UUID> page1 = repository.findIdsBySearch("station", PageRequest.of(1, 2));

            assertThat(page0.getContent()).hasSize(2);
            assertThat(page0.getTotalElements()).isEqualTo(3);
            assertThat(page0.getTotalPages()).isEqualTo(2);
            assertThat(page1.getContent()).hasSize(1);
        }

        @Test
        @DisplayName("findAllByIdInWithLines slim variant returns lines without devices")
        void slimHydrate() {
            Page<UUID> idsPage = repository.findIdsBySearch("NORTH", PageRequest.of(0, 10));
            List<Stop> hydrated = repository.findAllByIdInWithLines(idsPage.getContent());

            assertThat(hydrated).hasSize(1);
            assertThat(hydrated.getFirst().getName()).isEqualTo("North Station");
            assertThat(hydrated.getFirst().getLines()).hasSize(1);
        }
    }

    @Nested
    @DisplayName("findAllIds + findAllByIdInWithLinesAndDevices (paginated two-step)")
    class FindAllPaginatedTwoStep {

        @Test
        @DisplayName("first page returns ids that hydrate with lines + devices")
        void returnsPaginatedResults() {
            Page<UUID> idsPage = repository.findAllIds(PageRequest.of(0, 2));
            List<Stop> hydrated = repository.findAllByIdInWithLinesAndDevices(idsPage.getContent());

            assertThat(idsPage.getContent()).hasSize(2);
            assertThat(idsPage.getTotalElements()).isEqualTo(3);
            assertThat(idsPage.getTotalPages()).isEqualTo(2);
            assertThat(hydrated).hasSize(2);
        }

        @Test
        @DisplayName("full page returns every stop")
        void fullPage() {
            Page<UUID> idsPage = repository.findAllIds(PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).hasSize(3);
            assertThat(idsPage.getTotalElements()).isEqualTo(3);
        }
    }

    @Nested
    @DisplayName("findIdsByLineId (paginated)")
    class FindIdsByLineIdPaginated {

        @Test
        @DisplayName("returns paginated stop ids for a specific line")
        void returnsPaginatedStopsForLine() {
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

        @Test
        @DisplayName("returns paginated stops for a specific line — full count")
        void fullCountForLine() {
            Page<UUID> idsPage = repository.findIdsByLineId(
                    lineB2.getId(), PageRequest.of(0, 10));

            assertThat(idsPage.getContent()).hasSize(2);
            assertThat(idsPage.getTotalElements()).isEqualTo(2);
        }
    }

    @Nested
    @DisplayName("findIdsByLineIdAndSearch (paginated)")
    class FindIdsByLineIdAndSearch {

        @Test
        @DisplayName("filters by both line and search term")
        void filtersByLineAndSearch() {
            Page<UUID> idsPage = repository.findIdsByLineIdAndSearch(
                    lineM1.getId(), "central", PageRequest.of(0, 10));
            List<Stop> hydrated = repository.findAllByIdInWithLinesAndDevices(idsPage.getContent());

            assertThat(hydrated).hasSize(1);
            assertThat(hydrated.getFirst().getName()).isEqualTo("Central Station");
        }

        @Test
        @DisplayName("returns empty when search matches but line does not")
        void returnsEmptyWhenLineDoesNotMatch() {
            Page<UUID> idsPage = repository.findIdsByLineIdAndSearch(
                    lineM1.getId(), "south", PageRequest.of(0, 10));

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
        @DisplayName("hydrate keeps lines bound to each stop")
        void slimHydrateKeepsLines() {
            Page<UUID> idsPage = repository.findIdsByLineIdAndSearch(
                    lineB2.getId(), "south", PageRequest.of(0, 10));
            List<Stop> hydrated = repository.findAllByIdInWithLines(idsPage.getContent());

            assertThat(hydrated).hasSize(1);
            assertThat(hydrated.getFirst().getName()).isEqualTo("South Station");
            assertThat(hydrated.getFirst().getLines()).hasSize(1);
        }
    }
}
