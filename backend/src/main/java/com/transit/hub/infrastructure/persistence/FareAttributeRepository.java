package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.FareAttribute;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface FareAttributeRepository extends JpaRepository<FareAttribute, UUID> {

    /** Loads every fare attribute with its rules eagerly so the admin
     *  endpoint can serialise the lot without N+1 lookups. */
    @Query("SELECT DISTINCT fa FROM FareAttribute fa "
            + "LEFT JOIN FETCH fa.rules r "
            + "LEFT JOIN FETCH r.route "
            + "LEFT JOIN FETCH fa.agency")
    List<FareAttribute> findAllWithRules();
}
