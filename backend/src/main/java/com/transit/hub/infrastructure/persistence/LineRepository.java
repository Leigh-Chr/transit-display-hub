package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Line;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.UUID;

@Repository
public interface LineRepository extends JpaRepository<Line, UUID> {
    Optional<Line> findByCode(String code);
    boolean existsByCode(String code);
}
