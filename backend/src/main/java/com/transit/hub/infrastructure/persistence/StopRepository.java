package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Stop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StopRepository extends JpaRepository<Stop, UUID> {
    List<Stop> findByLineId(UUID lineId);

    @Query("SELECT s FROM Stop s JOIN FETCH s.line")
    List<Stop> findAllWithLine();

    @Query("SELECT s FROM Stop s JOIN FETCH s.line WHERE s.line.id = :lineId")
    List<Stop> findByLineIdWithLine(UUID lineId);
}
