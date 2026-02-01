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
    List<TimedEntry> findByStopIdOrderByTime(UUID stopId);

    @Query("SELECT t FROM TimedEntry t WHERE t.stop.id = :stopId AND t.time > :time ORDER BY t.time")
    List<TimedEntry> findByStopIdAndTimeAfter(UUID stopId, LocalTime time);

    void deleteByStopId(UUID stopId);
}
