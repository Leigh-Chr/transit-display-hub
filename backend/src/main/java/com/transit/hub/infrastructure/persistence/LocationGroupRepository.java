package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.LocationGroup;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface LocationGroupRepository extends JpaRepository<LocationGroup, UUID> {

    /** Projection used by {@code GtfsImportService.validateGlobalIdUniqueness}:
     *  loads only the external id column instead of hydrating full
     *  LocationGroup entities (and their member stop sets). */
    @Query("SELECT lg.externalId FROM LocationGroup lg WHERE lg.externalId IS NOT NULL")
    List<String> findAllExternalIds();
}
