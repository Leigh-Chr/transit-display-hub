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

    /** Bounding-box pre-filter: returns every location whose persisted
     *  bbox covers the input point. Cheap on the DB side (four numeric
     *  comparisons against indexable columns), and the admin-side
     *  point-in-polygon pass narrows the result down to the actual
     *  containing zones. Locations with null bbox columns (legacy rows
     *  pre-V35) are excluded — re-import the feed to refresh them. */
    @Query("""
            SELECT l FROM Location l
            WHERE l.minLatitude IS NOT NULL AND l.maxLatitude IS NOT NULL
              AND l.minLongitude IS NOT NULL AND l.maxLongitude IS NOT NULL
              AND :lat BETWEEN l.minLatitude AND l.maxLatitude
              AND :lon BETWEEN l.minLongitude AND l.maxLongitude
            """)
    List<Location> findByBoundingBoxContaining(
            @org.springframework.data.repository.query.Param("lat") double lat,
            @org.springframework.data.repository.query.Param("lon") double lon);
}
