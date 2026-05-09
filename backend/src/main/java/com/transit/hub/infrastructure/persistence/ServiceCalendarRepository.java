package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.ServiceCalendar;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.UUID;

@Repository
public interface ServiceCalendarRepository extends JpaRepository<ServiceCalendar, UUID> {

    /** Eagerly fetches the {@code exceptions} association so the matcher
     *  can evaluate {@code calendar_dates.txt} additions / removals
     *  without triggering an N+1 lazy load per schedule. */
    @Query("SELECT DISTINCT sc FROM ServiceCalendar sc LEFT JOIN FETCH sc.exceptions")
    List<ServiceCalendar> findAllWithExceptions();
}
