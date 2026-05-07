package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.BookingRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.UUID;

@Repository
public interface BookingRuleRepository extends JpaRepository<BookingRule, UUID> {
}
