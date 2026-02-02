package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Stop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface StopRepository extends JpaRepository<Stop, UUID> {

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines")
    List<Stop> findAllWithLines();

    @Query("SELECT s FROM Stop s LEFT JOIN FETCH s.lines WHERE s.id = :id")
    Optional<Stop> findByIdWithLines(UUID id);

    @Query("SELECT DISTINCT s FROM Stop s JOIN s.lines l WHERE l.id = :lineId")
    List<Stop> findByLineId(UUID lineId);

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)")
    List<Stop> findByLineIdWithLines(UUID lineId);
}
