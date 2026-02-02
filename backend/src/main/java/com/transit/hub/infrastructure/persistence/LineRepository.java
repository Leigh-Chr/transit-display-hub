package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Line;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LineRepository extends JpaRepository<Line, UUID> {
    Optional<Line> findByCode(String code);
    boolean existsByCode(String code);

    @Query("SELECT l FROM Line l WHERE " +
           "LOWER(l.code) LIKE LOWER(CONCAT('%', :search, '%')) OR " +
           "LOWER(l.name) LIKE LOWER(CONCAT('%', :search, '%'))")
    Page<Line> findBySearch(String search, Pageable pageable);

    Page<Line> findAll(Pageable pageable);
}
