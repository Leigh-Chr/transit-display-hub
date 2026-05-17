package com.transit.hub.application.support;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Shared helper for the 2-step pagination idiom used by every paginated
 * admin service that needs to JOIN FETCH collections: first paginate
 * ids via the database, then hydrate only the page's entities via an
 * IN-query that's free of pagination. The IN-query loses the page's
 * ordering, so we re-thread it through a UUID → entity map.
 *
 * <p>Extracted from {@code StopService}, {@code LineService},
 * {@code ItineraryService} and {@code DashboardService} where the same
 * stream → toMap → map → filter(Objects::nonNull) → toList ran four
 * times verbatim.
 */
public final class Pages {

    private Pages() {}

    /**
     * Re-orders {@code hydrated} to match the order of {@code idsPage}
     * and wraps it back in a {@link Page} with the original total count.
     * Entities present in {@code idsPage} but missing from
     * {@code hydrated} (deleted between the two queries) are silently
     * dropped — the page total still reflects the head count, which the
     * frontend treats as eventually consistent.
     */
    public static <T> Page<T> hydrate(Page<UUID> idsPage, List<T> hydrated, Function<T, UUID> idExtractor) {
        Map<UUID, T> byId = hydrated.stream()
                .collect(Collectors.toMap(idExtractor, t -> t));
        List<T> ordered = idsPage.getContent().stream()
                .map(byId::get)
                .filter(Objects::nonNull)
                .toList();
        return new PageImpl<>(ordered, idsPage.getPageable(), idsPage.getTotalElements());
    }
}
