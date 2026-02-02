package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Itinerary;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface ItineraryRepository extends JpaRepository<Itinerary, UUID> {

    @Query("SELECT DISTINCT i FROM Itinerary i " +
           "JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is " +
           "LEFT JOIN FETCH is.stop " +
           "ORDER BY i.line.code, i.name")
    List<Itinerary> findAllWithLineAndStops();

    @Query("SELECT DISTINCT i FROM Itinerary i " +
           "JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is " +
           "LEFT JOIN FETCH is.stop " +
           "WHERE i.id = :id")
    Optional<Itinerary> findByIdWithLineAndStops(UUID id);

    @Query("SELECT i FROM Itinerary i JOIN FETCH i.line WHERE i.id = :id")
    Optional<Itinerary> findByIdWithLine(UUID id);

    @Query("SELECT DISTINCT i FROM Itinerary i " +
           "JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops is " +
           "LEFT JOIN FETCH is.stop " +
           "WHERE i.line.id = :lineId " +
           "ORDER BY i.name")
    List<Itinerary> findByLineIdWithLineAndStops(UUID lineId);

    boolean existsByLineIdAndName(UUID lineId, String name);

    @Query("SELECT CASE WHEN COUNT(i) > 0 THEN true ELSE false END FROM Itinerary i " +
           "WHERE i.line.id = :lineId AND i.name = :name AND i.id != :excludeId")
    boolean existsByLineIdAndNameExcludingId(UUID lineId, String name, UUID excludeId);

    List<Itinerary> findByLineId(UUID lineId);

    void deleteByLineId(UUID lineId);

    @Query(value = "SELECT DISTINCT i FROM Itinerary i " +
           "JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops",
           countQuery = "SELECT COUNT(i) FROM Itinerary i")
    Page<Itinerary> findAllWithLine(Pageable pageable);

    @Query(value = "SELECT DISTINCT i FROM Itinerary i " +
           "JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops " +
           "WHERE i.line.id = :lineId",
           countQuery = "SELECT COUNT(i) FROM Itinerary i WHERE i.line.id = :lineId")
    Page<Itinerary> findByLineIdWithLine(UUID lineId, Pageable pageable);

    @Query(value = "SELECT DISTINCT i FROM Itinerary i " +
           "JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops " +
           "WHERE LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))",
           countQuery = "SELECT COUNT(i) FROM Itinerary i " +
           "WHERE LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Itinerary> findBySearchWithLine(String search, Pageable pageable);

    @Query(value = "SELECT DISTINCT i FROM Itinerary i " +
           "JOIN FETCH i.line " +
           "LEFT JOIN FETCH i.itineraryStops " +
           "WHERE i.line.id = :lineId AND " +
           "LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))",
           countQuery = "SELECT COUNT(i) FROM Itinerary i WHERE i.line.id = :lineId AND " +
           "LOWER(i.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Itinerary> findByLineIdAndSearchWithLine(UUID lineId, String search, Pageable pageable);
}
