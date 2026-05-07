package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.FareTransferRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FareTransferRuleRepository extends JpaRepository<FareTransferRule, UUID> {

    @Query("SELECT r FROM FareTransferRule r LEFT JOIN FETCH r.fareProduct")
    List<FareTransferRule> findAllWithProduct();
}
