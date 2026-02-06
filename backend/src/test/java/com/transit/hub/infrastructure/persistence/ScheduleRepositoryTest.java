package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Schedule;
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
import org.springframework.test.context.ActiveProfiles;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ImportAutoConfiguration(CacheAutoConfiguration.class)
@ActiveProfiles("test")
@DisplayName("ScheduleRepository")
class ScheduleRepositoryTest {

    @Autowired
    private ScheduleRepository repository;

    @Autowired
    private TestEntityManager em;

    private Line line;
    private Stop stopA;
    private Stop stopB;
    private Stop stopC;
    private Itinerary itinerary1;
    private Itinerary itinerary2;

    @BeforeEach
    void setUp() {
        line = Line.builder()
                .code("M1")
                .name("Metro Line 1")
                .color("#FF0000")
                .type(LineType.METRO)
                .build();
        em.persist(line);

        stopA = Stop.builder().name("Station Alpha").build();
        stopA.addLine(line);
        em.persist(stopA);

        stopB = Stop.builder().name("Station Beta").build();
        stopB.addLine(line);
        em.persist(stopB);

        stopC = Stop.builder().name("Station Gamma").build();
        stopC.addLine(line);
        em.persist(stopC);

        itinerary1 = Itinerary.builder()
                .line(line)
                .name("Alpha to Gamma")
                .build();
        em.persist(itinerary1);

        // Add itinerary stops
        ItineraryStop is1 = ItineraryStop.builder()
                .itinerary(itinerary1)
                .stop(stopA)
                .position(0)
                .build();
        em.persist(is1);

        ItineraryStop is2 = ItineraryStop.builder()
                .itinerary(itinerary1)
                .stop(stopB)
                .position(1)
                .build();
        em.persist(is2);

        ItineraryStop is3 = ItineraryStop.builder()
                .itinerary(itinerary1)
                .stop(stopC)
                .position(2)
                .build();
        em.persist(is3);

        itinerary2 = Itinerary.builder()
                .line(line)
                .name("Gamma to Alpha")
                .build();
        em.persist(itinerary2);

        ItineraryStop is4 = ItineraryStop.builder()
                .itinerary(itinerary2)
                .stop(stopC)
                .position(0)
                .build();
        em.persist(is4);

        ItineraryStop is5 = ItineraryStop.builder()
                .itinerary(itinerary2)
                .stop(stopA)
                .position(1)
                .build();
        em.persist(is5);

        em.flush();
        em.clear();
    }

    private Schedule persistSchedule(LocalTime time, Stop stop, Itinerary itinerary) {
        Schedule schedule = Schedule.builder()
                .time(time)
                .stop(stop)
                .itinerary(itinerary)
                .build();
        em.persist(schedule);
        return schedule;
    }

    @Nested
    @DisplayName("findByStopIdWithItineraryOrderByTime")
    class FindByStopIdWithItineraryOrderByTime {

        @Test
        @DisplayName("returns schedules for the given stop ordered by time ascending")
        void returnsSchedulesOrderedByTime() {
            persistSchedule(LocalTime.of(10, 30), stopA, itinerary1);
            persistSchedule(LocalTime.of(8, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(14, 15), stopA, itinerary2);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdWithItineraryOrderByTime(stopA.getId());

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getTime()).isEqualTo(LocalTime.of(8, 0));
            assertThat(result.get(1).getTime()).isEqualTo(LocalTime.of(10, 30));
            assertThat(result.get(2).getTime()).isEqualTo(LocalTime.of(14, 15));
        }

        @Test
        @DisplayName("does not include schedules for other stops")
        void excludesOtherStopsSchedules() {
            persistSchedule(LocalTime.of(8, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(9, 0), stopB, itinerary1);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdWithItineraryOrderByTime(stopA.getId());

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getStop().getId()).isEqualTo(stopA.getId());
        }

        @Test
        @DisplayName("eagerly fetches itinerary, line, itineraryStops, and their stops")
        void eagerlyFetchesRelatedEntities() {
            persistSchedule(LocalTime.of(8, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdWithItineraryOrderByTime(stopA.getId());

            assertThat(result).hasSize(1);
            Schedule schedule = result.getFirst();
            // Access lazy relationships - should not throw LazyInitializationException
            assertThat(schedule.getItinerary().getName()).isEqualTo("Alpha to Gamma");
            assertThat(schedule.getItinerary().getLine().getCode()).isEqualTo("M1");
            assertThat(schedule.getItinerary().getItineraryStops()).isNotEmpty();
            assertThat(schedule.getItinerary().getItineraryStops().getFirst().getStop().getName()).isNotBlank();
        }

        @Test
        @DisplayName("returns empty list when stop has no schedules")
        void returnsEmptyWhenNoSchedules() {
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdWithItineraryOrderByTime(stopC.getId());

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns empty list for non-existent stop id")
        void returnsEmptyForNonExistentStop() {
            List<Schedule> result = repository.findByStopIdWithItineraryOrderByTime(UUID.randomUUID());

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByStopIdAndTimeAfterWithItinerary")
    class FindByStopIdAndTimeAfterWithItinerary {

        @Test
        @DisplayName("returns only schedules with time strictly after the given time")
        void returnsSchedulesAfterGivenTime() {
            persistSchedule(LocalTime.of(8, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(10, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(12, 0), stopA, itinerary2);
            persistSchedule(LocalTime.of(14, 0), stopA, itinerary2);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdAndTimeAfterWithItinerary(
                    stopA.getId(), LocalTime.of(10, 0));

            assertThat(result).hasSize(2);
            assertThat(result.get(0).getTime()).isEqualTo(LocalTime.of(12, 0));
            assertThat(result.get(1).getTime()).isEqualTo(LocalTime.of(14, 0));
        }

        @Test
        @DisplayName("excludes schedules with time exactly equal to the given time (strictly after)")
        void excludesSchedulesAtExactTime() {
            persistSchedule(LocalTime.of(10, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdAndTimeAfterWithItinerary(
                    stopA.getId(), LocalTime.of(10, 0));

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns results ordered by time ascending")
        void resultsAreOrderedByTime() {
            persistSchedule(LocalTime.of(18, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(12, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(15, 0), stopA, itinerary2);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdAndTimeAfterWithItinerary(
                    stopA.getId(), LocalTime.of(11, 0));

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getTime()).isEqualTo(LocalTime.of(12, 0));
            assertThat(result.get(1).getTime()).isEqualTo(LocalTime.of(15, 0));
            assertThat(result.get(2).getTime()).isEqualTo(LocalTime.of(18, 0));
        }

        @Test
        @DisplayName("returns empty when all schedules are before the given time")
        void returnsEmptyWhenAllBefore() {
            persistSchedule(LocalTime.of(6, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(8, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdAndTimeAfterWithItinerary(
                    stopA.getId(), LocalTime.of(22, 0));

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findByStopIdAndTimeWindowWithItinerary")
    class FindByStopIdAndTimeWindowWithItinerary {

        @Test
        @DisplayName("returns schedules within time window (startTime exclusive, endTime inclusive)")
        void returnsSchedulesInTimeWindow() {
            persistSchedule(LocalTime.of(8, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(10, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(12, 0), stopA, itinerary2);
            persistSchedule(LocalTime.of(14, 0), stopA, itinerary2);
            persistSchedule(LocalTime.of(16, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            // time > 8:00 AND time <= 14:00
            List<Schedule> result = repository.findByStopIdAndTimeWindowWithItinerary(
                    stopA.getId(), LocalTime.of(8, 0), LocalTime.of(14, 0));

            assertThat(result).hasSize(3);
            assertThat(result.get(0).getTime()).isEqualTo(LocalTime.of(10, 0));
            assertThat(result.get(1).getTime()).isEqualTo(LocalTime.of(12, 0));
            assertThat(result.get(2).getTime()).isEqualTo(LocalTime.of(14, 0));
        }

        @Test
        @DisplayName("excludes schedules at startTime (strictly after)")
        void excludesSchedulesAtStartTime() {
            persistSchedule(LocalTime.of(10, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(11, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdAndTimeWindowWithItinerary(
                    stopA.getId(), LocalTime.of(10, 0), LocalTime.of(12, 0));

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getTime()).isEqualTo(LocalTime.of(11, 0));
        }

        @Test
        @DisplayName("includes schedules at endTime (inclusive)")
        void includesSchedulesAtEndTime() {
            persistSchedule(LocalTime.of(12, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdAndTimeWindowWithItinerary(
                    stopA.getId(), LocalTime.of(10, 0), LocalTime.of(12, 0));

            assertThat(result).hasSize(1);
        }

        @Test
        @DisplayName("returns empty when no schedules fall in the window")
        void returnsEmptyWhenNoMatchInWindow() {
            persistSchedule(LocalTime.of(8, 0), stopA, itinerary1);
            persistSchedule(LocalTime.of(18, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            List<Schedule> result = repository.findByStopIdAndTimeWindowWithItinerary(
                    stopA.getId(), LocalTime.of(10, 0), LocalTime.of(14, 0));

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("existsByStopIdAndItineraryIdAndTime")
    class ExistsByStopIdAndItineraryIdAndTime {

        @Test
        @DisplayName("returns true when exact match exists")
        void returnsTrueForExactMatch() {
            persistSchedule(LocalTime.of(8, 30), stopA, itinerary1);
            em.flush();
            em.clear();

            boolean exists = repository.existsByStopIdAndItineraryIdAndTime(
                    stopA.getId(), itinerary1.getId(), LocalTime.of(8, 30));

            assertThat(exists).isTrue();
        }

        @Test
        @DisplayName("returns false when stop matches but itinerary differs")
        void returnsFalseWhenItineraryDiffers() {
            persistSchedule(LocalTime.of(8, 30), stopA, itinerary1);
            em.flush();
            em.clear();

            boolean exists = repository.existsByStopIdAndItineraryIdAndTime(
                    stopA.getId(), itinerary2.getId(), LocalTime.of(8, 30));

            assertThat(exists).isFalse();
        }

        @Test
        @DisplayName("returns false when stop and itinerary match but time differs")
        void returnsFalseWhenTimeDiffers() {
            persistSchedule(LocalTime.of(8, 30), stopA, itinerary1);
            em.flush();
            em.clear();

            boolean exists = repository.existsByStopIdAndItineraryIdAndTime(
                    stopA.getId(), itinerary1.getId(), LocalTime.of(9, 0));

            assertThat(exists).isFalse();
        }

        @Test
        @DisplayName("returns false when itinerary and time match but stop differs")
        void returnsFalseWhenStopDiffers() {
            persistSchedule(LocalTime.of(8, 30), stopA, itinerary1);
            em.flush();
            em.clear();

            boolean exists = repository.existsByStopIdAndItineraryIdAndTime(
                    stopB.getId(), itinerary1.getId(), LocalTime.of(8, 30));

            assertThat(exists).isFalse();
        }

        @Test
        @DisplayName("returns false when no schedules exist at all")
        void returnsFalseWhenEmpty() {
            em.flush();
            em.clear();

            boolean exists = repository.existsByStopIdAndItineraryIdAndTime(
                    stopA.getId(), itinerary1.getId(), LocalTime.of(8, 30));

            assertThat(exists).isFalse();
        }
    }

    @Nested
    @DisplayName("existsByStopIdAndItineraryIdAndTimeExcludingId")
    class ExistsByStopIdAndItineraryIdAndTimeExcludingId {

        @Test
        @DisplayName("returns false when the only matching schedule is the excluded one")
        void returnsFalseWhenExcludedMatchesOnly() {
            Schedule schedule = persistSchedule(LocalTime.of(8, 30), stopA, itinerary1);
            em.flush();
            em.clear();

            boolean exists = repository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                    stopA.getId(), itinerary1.getId(), LocalTime.of(8, 30), schedule.getId());

            assertThat(exists).isFalse();
        }

        @Test
        @DisplayName("returns true when another schedule with same combination exists")
        void returnsTrueWhenDuplicateExists() {
            Schedule schedule1 = persistSchedule(LocalTime.of(8, 30), stopA, itinerary1);
            // Note: due to unique constraint, we test with a different itinerary but same stop+time
            // Actually, the unique constraint is (stop_id, itinerary_id, time), so let's test
            // a scenario where we check if a different schedule has the same combination
            Schedule schedule2 = persistSchedule(LocalTime.of(9, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            // Check if stopA + itinerary1 + 8:30 exists, excluding schedule2's ID
            boolean exists = repository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                    stopA.getId(), itinerary1.getId(), LocalTime.of(8, 30), schedule2.getId());

            assertThat(exists).isTrue();
        }

        @Test
        @DisplayName("returns false when no other schedule matches after exclusion")
        void returnsFalseWhenNoOtherMatch() {
            Schedule schedule1 = persistSchedule(LocalTime.of(8, 30), stopA, itinerary1);
            Schedule schedule2 = persistSchedule(LocalTime.of(9, 0), stopA, itinerary1);
            em.flush();
            em.clear();

            // Check if stopA + itinerary1 + 9:00 exists, excluding schedule2's ID
            boolean exists = repository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                    stopA.getId(), itinerary1.getId(), LocalTime.of(9, 0), schedule2.getId());

            assertThat(exists).isFalse();
        }

        @Test
        @DisplayName("returns false with non-existent excludeId when no match exists")
        void returnsFalseWithRandomExcludeId() {
            em.flush();
            em.clear();

            boolean exists = repository.existsByStopIdAndItineraryIdAndTimeExcludingId(
                    stopA.getId(), itinerary1.getId(), LocalTime.of(8, 30), UUID.randomUUID());

            assertThat(exists).isFalse();
        }
    }
}
