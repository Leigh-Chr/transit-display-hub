package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Shape;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface ShapeRepository extends JpaRepository<Shape, UUID> {

    /** Eagerly fetches the points list, ordered by sequence, so the
     *  controller serialises a polyline in a single query. */
    @Query("SELECT s FROM Shape s LEFT JOIN FETCH s.points WHERE s.id = :id")
    Optional<Shape> findByIdWithPoints(UUID id);
}
