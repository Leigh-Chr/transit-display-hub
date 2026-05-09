package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.FlexStopTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FlexStopTimeRepository extends JpaRepository<FlexStopTime, UUID> {

    /** Eagerly fetches everything the admin / popup needs to render a
     *  flex window without N+1: itinerary + line, location, location
     *  group, booking rules and the service calendar. Filtered by the
     *  GTFS external id of the location for the public lookup
     *  (passenger surface keys on the geojson feature id). */
    @Query("""
            SELECT f FROM FlexStopTime f
              JOIN FETCH f.itinerary i
              JOIN FETCH i.line
              LEFT JOIN FETCH f.location l
              LEFT JOIN FETCH f.locationGroup
              LEFT JOIN FETCH f.pickupBookingRule
              LEFT JOIN FETCH f.dropOffBookingRule
              LEFT JOIN FETCH f.serviceCalendar
              WHERE l.externalId = :externalId
              ORDER BY f.startPickupDropOffWindow
            """)
    List<FlexStopTime> findByLocationExternalId(String externalId);

    /** IDs of stops referenced by at least one flex_stop_times row. By
     *  spec the row only exists when the trip has on-request access at
     *  that stop (booking rules are required, the importer rejects
     *  rows without any window), so a stop here is always on-demand
     *  for the schematic-map TAD indicator. Mirrors the role of
     *  {@code ScheduleRepository.findStopIdsWithOnDemandPickup()} for
     *  feeds that publish flex windows instead of fixed timetables. */
    @Query("""
            SELECT DISTINCT f.stop.id FROM FlexStopTime f
              WHERE f.stop IS NOT NULL
            """)
    java.util.Set<UUID> findStopIdsTouchedByFlex();

    /** Eagerly fetches every flex stop time for an itinerary so the
     *  admin browse page can list them with their target. */
    @Query("""
            SELECT f FROM FlexStopTime f
              JOIN FETCH f.itinerary i
              JOIN FETCH i.line
              LEFT JOIN FETCH f.location
              LEFT JOIN FETCH f.locationGroup
              LEFT JOIN FETCH f.stop
              LEFT JOIN FETCH f.pickupBookingRule
              LEFT JOIN FETCH f.dropOffBookingRule
              LEFT JOIN FETCH f.serviceCalendar
              ORDER BY f.itinerary.id, f.stopSequence
            """)
    List<FlexStopTime> findAllWithRelations();
}
