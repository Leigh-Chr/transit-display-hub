package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.FlexStopTime;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FlexStopTimeRepository extends JpaRepository<FlexStopTime, UUID> {

    List<FlexStopTime> findByItineraryId(UUID itineraryId);

    List<FlexStopTime> findByLocationId(UUID locationId);

    List<FlexStopTime> findByLocationGroupId(UUID locationGroupId);
}
