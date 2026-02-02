package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Route;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface RouteRepository extends JpaRepository<Route, UUID> {

    @Query("SELECT r FROM Route r JOIN FETCH r.line ORDER BY r.line.code, r.name")
    List<Route> findAllWithLine();

    @Query("SELECT r FROM Route r JOIN FETCH r.line WHERE r.id = :id")
    Optional<Route> findByIdWithLine(UUID id);

    @Query("SELECT r FROM Route r JOIN FETCH r.line WHERE r.line.id = :lineId ORDER BY r.name")
    List<Route> findByLineIdWithLine(UUID lineId);

    boolean existsByLineIdAndName(UUID lineId, String name);

    @Query("SELECT CASE WHEN COUNT(r) > 0 THEN true ELSE false END FROM Route r " +
           "WHERE r.line.id = :lineId AND r.name = :name AND r.id != :excludeId")
    boolean existsByLineIdAndNameExcludingId(UUID lineId, String name, UUID excludeId);
}
