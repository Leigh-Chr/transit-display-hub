package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Timeframe;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface TimeframeRepository extends JpaRepository<Timeframe, UUID> {
}
