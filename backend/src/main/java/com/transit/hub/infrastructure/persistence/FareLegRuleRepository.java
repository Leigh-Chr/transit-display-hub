package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.FareLegRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FareLegRuleRepository extends JpaRepository<FareLegRule, UUID> {

    @Query("SELECT r FROM FareLegRule r LEFT JOIN FETCH r.fromArea LEFT JOIN FETCH r.toArea " +
           "LEFT JOIN FETCH r.fareProduct ORDER BY r.rulePriority NULLS LAST")
    List<FareLegRule> findAllWithRefs();
}
