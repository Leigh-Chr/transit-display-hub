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
}
