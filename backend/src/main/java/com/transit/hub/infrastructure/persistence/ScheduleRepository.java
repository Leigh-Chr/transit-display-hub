package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalTime;
import java.util.Collection;
import java.util.List;
import java.util.UUID;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, UUID> {

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId ORDER BY s.time")
    List<Schedule> findByStopIdWithItineraryOrderByTime(UUID stopId);

    /** Unified time-window query for a single stop: startTime exclusive, endTime
     *  inclusive (s.time &gt; startTime AND s.time &lt;= endTime). Used for the
     *  within-day window ({@link #findByStopIdAndTimeWindowWithItinerary}) and the
     *  before-or-equal midnight branch ({@link #findByStopIdAndTimeBeforeOrEqualWithItinerary}).
     *  The "after" variant keeps its own simpler predicate to avoid an upper-bound
     *  sentinel that H2 may round-trip incorrectly at nanosecond precision. */
    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId AND s.time > :startTime AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdInTimeWindow(UUID stopId, LocalTime startTime, LocalTime endTime);

    /** Unified time-window query for a collection of stops: startTime exclusive,
     *  endTime inclusive. Phase 1.3 parent-station fan-out variant. */
    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id IN :stopIds AND s.time > :startTime AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdsInTimeWindow(Collection<UUID> stopIds, LocalTime startTime, LocalTime endTime);

    // Backward-compatible named wrappers — kept so DisplayStateCalculator and
    // existing tests require no changes. The 4 derived queries above are the
    // single source of truth; the 6 names here are thin delegations.

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId AND s.time > :time ORDER BY s.time")
    List<Schedule> findByStopIdAndTimeAfterWithItinerary(UUID stopId, LocalTime time);

    default List<Schedule> findByStopIdAndTimeWindowWithItinerary(UUID stopId, LocalTime startTime, LocalTime endTime) {
        return findByStopIdInTimeWindow(stopId, startTime, endTime);
    }

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdAndTimeBeforeOrEqualWithItinerary(UUID stopId, LocalTime endTime);

    default List<Schedule> findByStopIdsAndTimeWindowWithItinerary(Collection<UUID> stopIds,
                                                                    LocalTime startTime, LocalTime endTime) {
        return findByStopIdsInTimeWindow(stopIds, startTime, endTime);
    }

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id IN :stopIds AND s.time > :time ORDER BY s.time")
    List<Schedule> findByStopIdsAndTimeAfterWithItinerary(Collection<UUID> stopIds, LocalTime time);

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id IN :stopIds AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdsAndTimeBeforeOrEqualWithItinerary(Collection<UUID> stopIds, LocalTime endTime);

    void deleteByStopId(UUID stopId);

    /**
     * Bulk schedule-count lookup for a batch of stops, used by listing endpoints
     * to avoid the N+1 fetch that calling stop.getSchedules().size() would
     * trigger on each row. Typed projection — beats {@code List<Object[]>} on both
     * readability (no [0]/[1] indexing) and safety (no UUID/Long casts).
     */
    @Query("SELECT s.stop.id AS stopId, COUNT(s) AS count FROM Schedule s "
            + "WHERE s.stop.id IN :stopIds GROUP BY s.stop.id")
    List<ScheduleStopCount> countByStopIdIn(java.util.Collection<UUID> stopIds);

    /** Projection row for {@link #countByStopIdIn}. */
    interface ScheduleStopCount {
        UUID getStopId();
        long getCount();
    }

    boolean existsByStopIdAndItineraryIdAndTime(UUID stopId, UUID itineraryId, LocalTime time);

    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END FROM Schedule s " +
           "WHERE s.stop.id = :stopId AND s.itinerary.id = :itineraryId AND s.time = :time AND s.id != :excludeId")
    boolean existsByStopIdAndItineraryIdAndTimeExcludingId(UUID stopId, UUID itineraryId, LocalTime time, UUID excludeId);

    void deleteByItineraryId(UUID itineraryId);

    void deleteByItineraryLineId(UUID lineId);

    /** Returns the set of stop ids that carry at least one schedule
     *  with an on-request pickup_type (2 = call agency, 3 = wave the
     *  driver). Powers the network-map TAD indicator without joining
     *  schedules client-side. */
    @Query("SELECT DISTINCT s.stop.id FROM Schedule s WHERE s.pickupType IN (2, 3)")
    java.util.Set<UUID> findStopIdsWithOnDemandPickup();

    /** Total schedule count per line (across every itinerary, every
     *  stop, every service calendar). Drives the network-map's edge
     *  thickness mapping: a line with 10 000 daily schedules draws
     *  a fatter trace than one with 200. The aggregate is rough — it
     *  doesn't normalise per stop or per service day — but it lets
     *  consumers rank lines by activity without shipping every
     *  schedule. Typed projection so callers don't index into Object[]. */
    @Query("SELECT i.line.id AS lineId, COUNT(s) AS count FROM Schedule s "
            + "JOIN s.itinerary i GROUP BY i.line.id")
    List<LineScheduleCount> countByLineId();

    /** Projection row for {@link #countByLineId}. */
    interface LineScheduleCount {
        UUID getLineId();
        long getCount();
    }

}
