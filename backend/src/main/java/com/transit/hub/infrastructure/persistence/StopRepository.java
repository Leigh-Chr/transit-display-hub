package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Stop;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

@Repository
public interface StopRepository extends JpaRepository<Stop, UUID> {

    /** Counts stops that the import flagged disabled because the new
     *  feed no longer references them. Used by the data-overview
     *  dashboard to surface "X stops orphaned" without forcing the
     *  admin to scroll the full list. */
    long countByDisabledTrue();

    /** Child platforms attached to a parent station. Phase 1.3
     *  fan-out: when a kiosk is bound to a parent stop, the display
     *  calculator unions the parent's own schedules with every
     *  child's so previously-collapsed bindings keep working. */
    @Query("SELECT s.id FROM Stop s WHERE s.parentStop.id = :parentId AND s.disabled = false")
    List<UUID> findChildIds(UUID parentId);

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines LEFT JOIN FETCH s.devices")
    List<Stop> findAllWithLinesAndDevices();

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines ORDER BY s.name")
    List<Stop> findAllWithLines();

    @Query("SELECT s FROM Stop s LEFT JOIN FETCH s.lines LEFT JOIN FETCH s.devices WHERE s.id = :id")
    Optional<Stop> findByIdWithLinesAndDevices(UUID id);

    @Query("SELECT s FROM Stop s LEFT JOIN FETCH s.lines WHERE s.id = :id")
    Optional<Stop> findByIdWithLines(UUID id);

    @Query("SELECT DISTINCT s FROM Stop s JOIN s.lines l WHERE l.id = :lineId")
    List<Stop> findByLineId(UUID lineId);

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines LEFT JOIN FETCH s.devices WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)")
    List<Stop> findByLineIdWithLinesAndDevices(UUID lineId);

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)")
    List<Stop> findByLineIdWithLines(UUID lineId);

    @Query("SELECT s.id FROM Stop s")
    Set<UUID> findAllIds();

    @Query(value = "SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines LEFT JOIN FETCH s.devices WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))",
           countQuery = "SELECT COUNT(DISTINCT s) FROM Stop s WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Stop> findBySearchWithLinesAndDevices(String search, Pageable pageable);

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Stop> findBySearchWithLines(String search, Pageable pageable);

    @Query(value = "SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines LEFT JOIN FETCH s.devices",
           countQuery = "SELECT COUNT(DISTINCT s) FROM Stop s")
    Page<Stop> findAllWithLinesAndDevices(Pageable pageable);

    @Query(value = "SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines",
           countQuery = "SELECT COUNT(DISTINCT s) FROM Stop s")
    Page<Stop> findAllWithLines(Pageable pageable);

    @Query(value = "SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines LEFT JOIN FETCH s.devices WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)",
           countQuery = "SELECT COUNT(DISTINCT s) FROM Stop s JOIN s.lines l WHERE l.id = :lineId")
    Page<Stop> findByLineIdWithLinesAndDevices(UUID lineId, Pageable pageable);

    @Query(value = "SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)",
           countQuery = "SELECT COUNT(DISTINCT s) FROM Stop s JOIN s.lines l WHERE l.id = :lineId")
    Page<Stop> findByLineIdWithLines(UUID lineId, Pageable pageable);

    @Query(value = "SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines LEFT JOIN FETCH s.devices WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) AND s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)",
           countQuery = "SELECT COUNT(DISTINCT s) FROM Stop s JOIN s.lines l WHERE l.id = :lineId AND " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Stop> findByLineIdAndSearchWithLinesAndDevices(UUID lineId, String search, Pageable pageable);

    @Query(value = "SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) AND s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)",
           countQuery = "SELECT COUNT(DISTINCT s) FROM Stop s JOIN s.lines l WHERE l.id = :lineId AND " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Stop> findByLineIdAndSearchWithLines(UUID lineId, String search, Pageable pageable);
}
