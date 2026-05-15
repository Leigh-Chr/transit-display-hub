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

    // The LEFT JOIN FETCH on l.agency below avoids the N+1 that
    // bit DisplayStateCalculator hot path: it reads
    // line.getAgency().getTimezone() / .getExternalId() for every
    // line of the polled stop, and without the eager fetch each call
    // re-issued a SELECT agency per line at the kiosk's 60 s tick.

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines l " +
           "LEFT JOIN FETCH l.agency LEFT JOIN FETCH s.devices")
    List<Stop> findAllWithLinesAndDevices();

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines l " +
           "LEFT JOIN FETCH l.agency LEFT JOIN FETCH s.parentStop ORDER BY s.name")
    List<Stop> findAllWithLines();

    @Query("SELECT s FROM Stop s LEFT JOIN FETCH s.lines l LEFT JOIN FETCH l.agency " +
           "LEFT JOIN FETCH s.devices WHERE s.id = :id")
    Optional<Stop> findByIdWithLinesAndDevices(UUID id);

    @Query("SELECT s FROM Stop s LEFT JOIN FETCH s.lines l LEFT JOIN FETCH l.agency WHERE s.id = :id")
    Optional<Stop> findByIdWithLines(UUID id);

    @Query("SELECT DISTINCT s FROM Stop s JOIN s.lines l WHERE l.id = :lineId")
    List<Stop> findByLineId(UUID lineId);

    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines l LEFT JOIN FETCH l.agency " +
           "LEFT JOIN FETCH s.devices WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l2 WHERE l2.id = :lineId)")
    List<Stop> findByLineIdWithLinesAndDevices(UUID lineId);

    @Query("SELECT s.id FROM Stop s")
    Set<UUID> findAllIds();

    /** Returns the subset of {@code candidateIds} that match an existing
     *  Stop row. Used by {@code HubDisplayService} so a hub bound to N
     *  stop ids can filter unknown ones in a single query instead of
     *  N {@code existsById} calls. */
    @Query("SELECT s.id FROM Stop s WHERE s.id IN :ids")
    List<UUID> findExistingIdsIn(List<UUID> ids);

    /** Two-step pagination, step 1: page Stop ids without collection
     *  fetches so Hibernate can paginate in SQL (HHH90003004 fix).
     *  Step 2 hydrates the page's entities below. */
    @Query(value = "SELECT s.id FROM Stop s",
           countQuery = "SELECT COUNT(s) FROM Stop s")
    Page<UUID> findAllIds(Pageable pageable);

    @Query(value = "SELECT s.id FROM Stop s WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))",
           countQuery = "SELECT COUNT(s) FROM Stop s WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<UUID> findIdsBySearch(String search, Pageable pageable);

    @Query(value = "SELECT s.id FROM Stop s WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)",
           countQuery = "SELECT COUNT(s) FROM Stop s WHERE s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)")
    Page<UUID> findIdsByLineId(UUID lineId, Pageable pageable);

    @Query(value = "SELECT s.id FROM Stop s WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) AND s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)",
           countQuery = "SELECT COUNT(s) FROM Stop s WHERE " +
           "LOWER(s.name) LIKE LOWER(CONCAT('%', :search, '%')) AND s IN " +
           "(SELECT s2 FROM Stop s2 JOIN s2.lines l WHERE l.id = :lineId)")
    Page<UUID> findIdsByLineIdAndSearch(UUID lineId, String search, Pageable pageable);

    /** Two-step pagination, step 2: hydrate the page's entities with
     *  lines + agency + devices in one round-trip. */
    @Query("SELECT DISTINCT s FROM Stop s LEFT JOIN FETCH s.lines l LEFT JOIN FETCH l.agency " +
           "LEFT JOIN FETCH s.devices WHERE s.id IN :ids")
    List<Stop> findAllByIdInWithLinesAndDevices(List<UUID> ids);
}
