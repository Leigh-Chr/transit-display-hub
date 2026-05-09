package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.BookingRule;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface BookingRuleRepository extends JpaRepository<BookingRule, UUID> {

    /** Returns every distinct booking rule referenced by a Schedule
     *  (pickup / drop-off) for the given stop, plus those referenced by
     *  any FlexStopTime targeting this stop. The set is the rules a
     *  passenger surface needs to render "how to book service at this
     *  stop". */
    @Query("""
            SELECT DISTINCT br FROM BookingRule br
              WHERE br IN (
                SELECT s.pickupBookingRule FROM Schedule s
                  WHERE s.stop.id = :stopId AND s.pickupBookingRule IS NOT NULL)
                OR br IN (
                SELECT s.dropOffBookingRule FROM Schedule s
                  WHERE s.stop.id = :stopId AND s.dropOffBookingRule IS NOT NULL)
                OR br IN (
                SELECT f.pickupBookingRule FROM FlexStopTime f
                  WHERE f.stop.id = :stopId AND f.pickupBookingRule IS NOT NULL)
                OR br IN (
                SELECT f.dropOffBookingRule FROM FlexStopTime f
                  WHERE f.stop.id = :stopId AND f.dropOffBookingRule IS NOT NULL)
            """)
    List<BookingRule> findByStopId(UUID stopId);
}
