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

    @Query("SELECT MAX(is.position) FROM ItineraryStop is WHERE is.itinerary.id = :itineraryId")
    Integer findMaxPositionByItineraryId(UUID itineraryId);
}
