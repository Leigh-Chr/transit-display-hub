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

    @Query("SELECT t FROM TimedEntry t JOIN FETCH t.line WHERE t.stop.id = :stopId ORDER BY t.time")
    List<TimedEntry> findByStopIdWithLineOrderByTime(UUID stopId);

    @Query("SELECT t FROM TimedEntry t JOIN FETCH t.line WHERE t.stop.id = :stopId AND t.time > :time ORDER BY t.time")
    List<TimedEntry> findByStopIdAndTimeAfterWithLine(UUID stopId, LocalTime time);

    void deleteByStopId(UUID stopId);
}
