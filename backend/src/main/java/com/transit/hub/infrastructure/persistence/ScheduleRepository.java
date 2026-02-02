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

    void deleteByStopId(UUID stopId);

    boolean existsByStopIdAndItineraryIdAndTime(UUID stopId, UUID itineraryId, LocalTime time);

    @Query("SELECT CASE WHEN COUNT(s) > 0 THEN true ELSE false END FROM Schedule s " +
           "WHERE s.stop.id = :stopId AND s.itinerary.id = :itineraryId AND s.time = :time AND s.id != :excludeId")
    boolean existsByStopIdAndItineraryIdAndTimeExcludingId(UUID stopId, UUID itineraryId, LocalTime time, UUID excludeId);

    void deleteByItineraryId(UUID itineraryId);

    void deleteByItineraryLineId(UUID lineId);
}
