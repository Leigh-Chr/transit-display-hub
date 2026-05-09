package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Location;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface LocationRepository extends JpaRepository<Location, UUID> {

    Optional<Location> findByExternalId(String externalId);

    /** All locations referencing the given GTFS stop_id (a TAD trip's
     *  flex pickup zone may be one of many for the same stop, e.g.
     *  morning vs evening service areas). */
    List<Location> findByStopExternalId(String stopExternalId);

    /** Browse-friendly variant ordered by external_id so the admin
     *  list stays stable across imports. */
    @Query("SELECT l FROM Location l ORDER BY l.externalId")
    List<Location> findAllOrdered();
}
