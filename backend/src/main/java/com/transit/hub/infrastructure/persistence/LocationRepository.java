package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Location;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LocationRepository extends JpaRepository<Location, UUID> {

    /** All locations referencing the given GTFS stop_id (a TAD trip's
     *  flex pickup zone may be one of many for the same stop, e.g.
     *  morning vs evening service areas). */
    List<Location> findByStopExternalId(String stopExternalId);

    /** Projection used by {@code GtfsImportService.validateGlobalIdUniqueness}:
     *  loads only the external id column instead of hydrating full Location entities. */
    @Query("SELECT l.externalId FROM Location l WHERE l.externalId IS NOT NULL")
    List<String> findAllExternalIds();
}
