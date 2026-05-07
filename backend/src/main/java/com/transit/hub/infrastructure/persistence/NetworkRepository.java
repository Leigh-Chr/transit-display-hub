package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Network;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface NetworkRepository extends JpaRepository<Network, UUID> {

    @Query("SELECT DISTINCT n FROM Network n LEFT JOIN FETCH n.routes ORDER BY n.name")
    List<Network> findAllWithRoutes();
}
