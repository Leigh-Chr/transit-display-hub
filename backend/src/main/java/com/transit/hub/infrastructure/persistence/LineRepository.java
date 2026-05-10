package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Line;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LineRepository extends JpaRepository<Line, UUID> {
    Optional<Line> findByCode(String code);
    boolean existsByCode(String code);

    @Query("SELECT l FROM Line l LEFT JOIN FETCH l.stops LEFT JOIN FETCH l.itineraries WHERE l.id = :id")
    Optional<Line> findByIdWithStopsAndRoutes(UUID id);

    @Query("SELECT DISTINCT l FROM Line l LEFT JOIN FETCH l.stops LEFT JOIN FETCH l.itineraries ORDER BY l.code")
    List<Line> findAllWithStopsAndRoutes();

    @Query("SELECT DISTINCT l FROM Line l LEFT JOIN FETCH l.itineraries i LEFT JOIN FETCH i.itineraryStops ist LEFT JOIN FETCH ist.stop ORDER BY l.code")
    List<Line> findAllWithItineraryStops();

    /** Two-step pagination, step 1: page Line ids matching the search.
     *  Without {@code JOIN FETCH} on collection associations Hibernate
     *  can paginate in SQL — the {@code WithStopsAndRoutes} variant did
     *  the opposite and dragged the entire result set into memory
     *  before slicing (HHH90003004). */
    @Query(value = "SELECT l.id FROM Line l WHERE " +
           "LOWER(l.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.name) LIKE LOWER(CONCAT('%', :search, '%'))",
           countQuery = "SELECT COUNT(l) FROM Line l WHERE " +
           "LOWER(l.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<UUID> findIdsBySearch(String search, Pageable pageable);

    /** Two-step pagination, step 1 — full listing variant. */
    @Query(value = "SELECT l.id FROM Line l",
           countQuery = "SELECT COUNT(l) FROM Line l")
    Page<UUID> findAllIds(Pageable pageable);

    /** Two-step pagination, step 2: hydrate the page's entities together
     *  with the collections the response needs, in one round-trip but
     *  bounded by the id list. */
    @Query("SELECT DISTINCT l FROM Line l LEFT JOIN FETCH l.stops LEFT JOIN FETCH l.itineraries " +
           "WHERE l.id IN :ids")
    List<Line> findAllByIdInWithStopsAndRoutes(List<UUID> ids);

    @Query("SELECT l FROM Line l WHERE " +
           "LOWER(l.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Line> findBySearch(String search, Pageable pageable);

    @Override
    Page<Line> findAll(Pageable pageable);
}
