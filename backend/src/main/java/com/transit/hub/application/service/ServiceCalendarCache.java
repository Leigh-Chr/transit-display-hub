package com.transit.hub.application.service;

import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.ServiceCalendar;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.annotation.CacheEvict;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Hot path: every kiosk render walks the schedule list and resolves
 * each one against its {@link ServiceCalendar}. The naive lookup hits
 * the DB twice (once for the calendars, once for the per-row exception
 * dates) per render — multiplied by 30s polling that's a non-trivial
 * fraction of total query time.
 *
 * <p>This cache fetches every calendar with its exceptions in one
 * query and serves the resolved map from memory until the next network
 * change. Importing GTFS (which is the only operation that mutates
 * calendars) fires a {@link NetworkChangedEvent} after commit, which
 * evicts the cache so the next render rebuilds it.
 */
@Service
@RequiredArgsConstructor
public class ServiceCalendarCache {

    private static final String CACHE_NAME = "calendars";

    private final ServiceCalendarRepository serviceCalendarRepository;

    /**
     * Returns every service calendar keyed by its UUID, with the
     * {@code calendar_exceptions} collection initialised so the caller
     * never trips a {@code LazyInitializationException} outside a
     * Hibernate session.
     */
    @Cacheable(CACHE_NAME)
    @Transactional(readOnly = true)
    public Map<UUID, ServiceCalendar> loadAll() {
        Map<UUID, ServiceCalendar> map = new HashMap<>();
        for (ServiceCalendar cal : serviceCalendarRepository.findAllWithExceptions()) {
            map.put(cal.getId(), cal);
        }
        return map;
    }

    /**
     * Evicts on network change (GTFS reimport, schedule edits, calendar
     * tweaks). {@link TransactionalEventListener} pinned to
     * {@code AFTER_COMMIT} so we don't pre-evict on a rolled-back tx.
     */
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    @CacheEvict(value = CACHE_NAME, allEntries = true)
    public void onNetworkChanged(NetworkChangedEvent event) {
        // body intentionally empty — @CacheEvict does the work
    }

    /**
     * Belt-and-suspenders alternate listener that catches events fired
     * from non-transactional contexts (e.g. boot loader, tests). The
     * transactional one is the primary path; this one keeps the cache
     * consistent when the event arrives without a surrounding
     * transaction.
     */
    @EventListener
    @CacheEvict(value = CACHE_NAME, allEntries = true)
    public void onNetworkChangedNonTransactional(NetworkChangedEvent event) {
        // body intentionally empty
    }
}
