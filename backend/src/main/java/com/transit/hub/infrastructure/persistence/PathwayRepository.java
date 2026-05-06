package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Pathway;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface PathwayRepository extends JpaRepository<Pathway, UUID> {

    /** All pathways with at least one endpoint at the given stop, eagerly
     *  fetching both endpoints so the controller can serialise them
     *  without an N+1. */
    @Query("SELECT p FROM Pathway p JOIN FETCH p.fromStop JOIN FETCH p.toStop " +
           "WHERE p.fromStop.id = :stopId OR p.toStop.id = :stopId")
    List<Pathway> findTouchingStop(UUID stopId);
}
