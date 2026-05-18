package com.transit.hub.infrastructure.seed.gtfs;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Cross-cutting helpers reused by the {@link
 * com.transit.hub.infrastructure.seed.gtfs.sections section importers}.
 * Lives outside any single importer so the four importers that share
 * the "pre-load by external_id" pattern do not have to copy 7 lines
 * of {@code Collectors.toMap} each.
 */
public final class GtfsImportSupport {

    private GtfsImportSupport() {
        // utility class — no instances
    }

    /**
     * Build an {@code externalId → entity} lookup from every row in
     * the repository so a re-import can update existing UUIDs in
     * place rather than insert fresh rows (which would unbind every
     * downstream FK on every refresh — see ADR 0013).
     *
     * <p>Entities whose {@code externalId} is {@code null} are
     * dropped; on duplicate external ids the first occurrence wins.
     * Callers that mutate the returned map should not rely on
     * insertion order — it is a regular {@link java.util.HashMap}.
     *
     * @param repo           the JPA repository to enumerate
     * @param externalIdGetter function returning the externalId of an entity
     * @return mutable map keyed by externalId
     */
    public static <E> Map<String, E> externalIdIndex(
            JpaRepository<E, ?> repo, Function<E, String> externalIdGetter) {
        return repo.findAll().stream()
                .filter(e -> externalIdGetter.apply(e) != null)
                .collect(Collectors.toMap(
                        externalIdGetter,
                        Function.identity(),
                        (a, b) -> a));
    }
}
