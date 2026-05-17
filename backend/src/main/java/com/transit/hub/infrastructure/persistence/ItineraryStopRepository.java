package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.ItineraryStop;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ItineraryStopRepository extends JpaRepository<ItineraryStop, UUID> {

    List<ItineraryStop> findByItineraryIdOrderByPosition(UUID itineraryId);

    @Query("SELECT is FROM ItineraryStop is " +
           "JOIN FETCH is.stop " +
           "WHERE is.itinerary.id = :itineraryId " +
           "ORDER BY is.position")
    List<ItineraryStop> findByItineraryIdWithStopOrderByPosition(UUID itineraryId);

    boolean existsByItineraryIdAndStopId(UUID itineraryId, UUID stopId);

    @Modifying
    @Query("DELETE FROM ItineraryStop is WHERE is.itinerary.id = :itineraryId")
    void deleteByItineraryId(UUID itineraryId);

    @Modifying
    @Query("DELETE FROM ItineraryStop is WHERE is.stop.id = :stopId")
    void deleteByStopId(UUID stopId);

    @Modifying
    @Query("DELETE FROM ItineraryStop is WHERE is.itinerary.line.id = :lineId")
    void deleteByItineraryLineId(UUID lineId);

    /**
     * Atomically shift every position >= fromPosition by +1 inside an itinerary.
     * Used before inserting a new stop in the middle, to avoid violating the
     * (itinerary_id, position) unique constraint that JPA would trigger if
     * each entity were updated one row at a time.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ItineraryStop is SET is.position = is.position + 1 " +
           "WHERE is.itinerary.id = :itineraryId AND is.position >= :fromPosition")
    void shiftPositionsFrom(UUID itineraryId, int fromPosition);

    /**
     * Bulk-shifts positions strictly greater than {@code removedPosition} down by 1.
     * Used after deleting an ItineraryStop to keep positions dense without issuing
     * one UPDATE per remaining row.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE ItineraryStop is SET is.position = is.position - 1 " +
           "WHERE is.itinerary.id = :itineraryId AND is.position > :removedPosition")
    int compactPositionsAbove(UUID itineraryId, int removedPosition);

    @Query("SELECT MAX(is.position) FROM ItineraryStop is WHERE is.itinerary.id = :itineraryId")
    Integer findMaxPositionByItineraryId(UUID itineraryId);
}
