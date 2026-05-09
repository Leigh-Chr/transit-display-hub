package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Area;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface AreaRepository extends JpaRepository<Area, UUID> {

    @Query("SELECT DISTINCT a FROM Area a LEFT JOIN FETCH a.stops ORDER BY a.name")
    List<Area> findAllWithStops();

    /** Areas that contain the given stop, used by the fare calculator to
     *  resolve origin/destination areas without hydrating the full
     *  M-N relationship from {@link com.transit.hub.domain.model.Stop}. */
    @Query("SELECT a FROM Area a JOIN a.stops s WHERE s.id = :stopId")
    List<Area> findByStopId(UUID stopId);
}
