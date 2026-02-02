package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.TimedEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface TimedEntryRepository extends JpaRepository<TimedEntry, UUID> {

    @Query("SELECT t FROM TimedEntry t JOIN FETCH t.route r JOIN FETCH r.line WHERE t.stop.id = :stopId ORDER BY t.time")
    List<TimedEntry> findByStopIdWithRouteOrderByTime(UUID stopId);

    @Query("SELECT t FROM TimedEntry t JOIN FETCH t.route r JOIN FETCH r.line WHERE t.stop.id = :stopId AND t.time > :time ORDER BY t.time")
    List<TimedEntry> findByStopIdAndTimeAfterWithRoute(UUID stopId, LocalTime time);

    @Query("SELECT t FROM TimedEntry t JOIN FETCH t.route r JOIN FETCH r.line WHERE t.stop.id = :stopId AND t.time > :startTime AND t.time <= :endTime ORDER BY t.time")
    List<TimedEntry> findByStopIdAndTimeWindowWithRoute(UUID stopId, LocalTime startTime, LocalTime endTime);

    void deleteByStopId(UUID stopId);

    boolean existsByStopIdAndRouteIdAndTime(UUID stopId, UUID routeId, LocalTime time);

    @Query("SELECT CASE WHEN COUNT(t) > 0 THEN true ELSE false END FROM TimedEntry t " +
           "WHERE t.stop.id = :stopId AND t.route.id = :routeId AND t.time = :time AND t.id != :excludeId")
    boolean existsByStopIdAndRouteIdAndTimeExcludingId(UUID stopId, UUID routeId, LocalTime time, UUID excludeId);

    void deleteByRouteId(UUID routeId);

    void deleteByRouteLineId(UUID lineId);
}
