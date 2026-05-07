package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Schedule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ScheduleRepository extends JpaRepository<Schedule, UUID> {

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId ORDER BY s.time")
    List<Schedule> findByStopIdWithItineraryOrderByTime(UUID stopId);

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId AND s.time > :time ORDER BY s.time")
    List<Schedule> findByStopIdAndTimeAfterWithItinerary(UUID stopId, LocalTime time);

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId AND s.time > :startTime AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdAndTimeWindowWithItinerary(UUID stopId, LocalTime startTime, LocalTime endTime);

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id = :stopId AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdAndTimeBeforeOrEqualWithItinerary(UUID stopId, LocalTime endTime);

    /** Phase 1.3 parent-station aggregation. Same shape as
     *  {@link #findByStopIdAndTimeWindowWithItinerary} but accepts a
     *  collection so a kiosk bound to a parent station can fan out
     *  across its child platforms. The single-id methods above still
     *  cover the regular per-platform case at lower JPQL cost. */
    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id IN :stopIds AND s.time > :startTime AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdsAndTimeWindowWithItinerary(java.util.Collection<UUID> stopIds,
                                                            LocalTime startTime, LocalTime endTime);

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id IN :stopIds AND s.time > :time ORDER BY s.time")
    List<Schedule> findByStopIdsAndTimeAfterWithItinerary(java.util.Collection<UUID> stopIds, LocalTime time);

    @Query("SELECT s FROM Schedule s JOIN FETCH s.itinerary i JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is LEFT JOIN FETCH is.stop " +
           "WHERE s.stop.id IN :stopIds AND s.time <= :endTime ORDER BY s.time")
    List<Schedule> findByStopIdsAndTimeBeforeOrEqualWithItinerary(java.util.Collection<UUID> stopIds, LocalTime endTime);

    void deleteByStopId(UUID stopId);

    /**
     * Bulk schedule-count lookup for a batch of stops, used by listing endpoints
     * to avoid the N+1 fetch that calling stop.getSchedules().size() would
     * trigger on each row.
     */
    @Query("SELECT s.stop.id, COUNT(s) FROM Schedule s WHERE s.stop.id IN :stopIds GROUP BY s.stop.id")
    List<Object[]> countByStopIdIn(java.util.Collection<UUID> stopIds);

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

}
