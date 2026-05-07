package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.FareLegJoinRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FareLegJoinRuleRepository extends JpaRepository<FareLegJoinRule, UUID> {

    @Query("SELECT r FROM FareLegJoinRule r LEFT JOIN FETCH r.fromStop LEFT JOIN FETCH r.toStop")
    List<FareLegJoinRule> findAllWithStops();
}
