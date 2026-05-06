package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.StationLevel;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface StationLevelRepository extends JpaRepository<StationLevel, UUID> {

    List<StationLevel> findByParentStopIdOrderByLevelIndex(UUID parentStopId);
}
