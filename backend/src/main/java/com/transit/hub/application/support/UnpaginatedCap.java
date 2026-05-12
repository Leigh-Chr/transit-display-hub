package com.transit.hub.application.support;

import org.slf4j.Logger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

/**
 * Defensive cap for service methods that still return {@code List<T>}
 * without a {@code Pageable} parameter — they were flagged by audit
 * 2026-05-12 (06-perf-observability.md P2) as OOM-prone if the
 * underlying table ever grows past what fits in heap.
 *
 * <p>Using this helper instead of {@link JpaRepository#findAll()}
 * (a) bounds the query at the JDBC layer (one round trip, fixed
 * fetch size) and (b) logs a warning the first time real data
 * crosses the cap, surfacing the row that demands a real paginated
 * endpoint without breaking the existing API contract.
 *
 * <p>The cap is intentionally generous: it protects against unbounded
 * growth without rate-limiting legitimate admin reads on bounded
 * GTFS data. The expected long-term migration is to retire the
 * unpaginated method when the calling UI gains real pagination.
 */
public final class UnpaginatedCap {

    /**
     * Hard upper bound on rows returned by an unpaginated service
     * method. 1 000 leaves head-room for every bounded GTFS source
     * the project ships fixtures for; broadcast messages (the only
     * table that can grow without an upstream bound) hit it long
     * before they fill RAM, so the warning fires before damage.
     */
    public static final int MAX_ROWS = 1_000;

    private UnpaginatedCap() {}

    /**
     * Read up to {@link #MAX_ROWS} rows from the supplied repository
     * and log a warning (with totalElements + caller label) when the
     * cap was actually reached, so observability picks up the day a
     * production deployment grows past the bound.
     */
    public static <T> List<T> findAllCapped(JpaRepository<T, ?> repository,
                                            Sort sort,
                                            Logger log,
                                            String callerLabel) {
        Page<T> page = repository.findAll(PageRequest.of(0, MAX_ROWS, sort));
        if (page.hasNext()) {
            log.warn("{} capped at {} rows (totalElements={}); the caller should switch to a paginated endpoint",
                    callerLabel, MAX_ROWS, page.getTotalElements());
        }
        return page.getContent();
    }

    /**
     * Variant for repositories that can't accept a {@link Sort}
     * (entity has no comparable fields) or that should keep their
     * existing client-side sort. The cap still applies.
     */
    public static <T> List<T> findAllCapped(JpaRepository<T, ?> repository,
                                            Logger log,
                                            String callerLabel) {
        return findAllCapped(repository, Sort.unsorted(), log, callerLabel);
    }
}
