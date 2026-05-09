# ADR 0023 — Two-step pagination on collection-fetched repositories

**Status:** Accepted

## Context

Three Spring Data repositories paginated entities while
`JOIN FETCH`ing one or more `@OneToMany` / `@ManyToMany` collections in
the same JPQL query: `LineRepository`, `ItineraryRepository`,
`StopRepository`. The shapes were:

```jpql
SELECT DISTINCT l FROM Line l
LEFT JOIN FETCH l.stops
LEFT JOIN FETCH l.itineraries
ORDER BY l.code
```

…called as `Page<Line> findAllWithStopsAndRoutes(Pageable pageable)`.

JPA can't paginate this in SQL: one logical row maps to many database
rows once a collection is joined, so `firstResult` / `maxResults` would
slice in the middle of an entity's children. Hibernate's documented
fallback is **in-memory pagination** — it issues the unbounded query,
materialises every entity into the heap, then trims to the requested
window. Hibernate also logs `HHH90003004` ("firstResult/maxResults
specified with collection fetch; applying in memory") on every such
call.

On the dev seed (M Réso Grenoble, 2 501 stops), a five-row dashboard
slice triggered:

- one full table scan over Lines + every line's stops + every line's
  itineraries
- ~2 500 rows materialised in the JVM
- a slice down to 5

The same shape applied to admin browsers (Lines, Itineraries, Stops),
each capable of paginating the entire visible table.

## Decision

**Replace the paginated `JOIN FETCH` queries with a two-step pattern**:

1. **Page over IDs only.** A bare `SELECT e.id FROM Entity e` with the
   same `WHERE` clause returns a `Page<UUID>`. SQL paginates because no
   collection is joined; the count query stays a plain `COUNT`.
2. **Hydrate the page's entities.** A second query
   `SELECT DISTINCT e FROM Entity e LEFT JOIN FETCH e.children
    WHERE e.id IN :ids` loads only the page's rows with their
   collections in a single round-trip.
3. **Stitch.** The service builds a `Map<UUID, Entity>` from the
   hydrate result and re-orders the page in the source ID order
   (`IN (:ids)` doesn't guarantee output ordering).

Repositories now expose three methods per shape:

```java
Page<UUID>    findAllIds(Pageable pageable);
Page<UUID>    findIdsBySearch(String s, Pageable pageable);
List<Entity>  findAllByIdInWithChildren(List<UUID> ids);
```

Service callers do:

```java
Page<UUID> idsPage = repo.findIdsBySearch(s, pageable);
if (idsPage.isEmpty()) return PageResponse.empty(pageable);
List<Entity> hydrated = repo.findAllByIdInWith...(idsPage.getContent());
Map<UUID,Entity> byId = hydrated.stream().collect(toMap(Entity::getId, e->e));
List<Entity> ordered = idsPage.getContent().stream()
        .map(byId::get).filter(Objects::nonNull).toList();
return PageResponse.from(new PageImpl<>(ordered, pageable, idsPage.getTotalElements()), …);
```

## Consequences

- **Pagination cost is now bounded by page size**, not table size.
  The dashboard's top-5 slice becomes one paginated id query + one
  `IN`-based hydrate of five rows.
- **Two queries per page instead of one**, but the saving on row
  materialisation dominates on any non-trivial table.
- **`HHH90003004` no longer logs** during normal admin use.
- **Tests carry the pattern**: `LineRepositoryTest`,
  `ItineraryRepositoryTest`, `StopRepositoryTest` cover both steps;
  service tests stub the new method pair.
- **Source ordering preserved** by the stitch step. Direct callers of
  the legacy `findAllWith…(Pageable)` methods must adopt the new
  pattern — an explicit refactor, not a transparent shim, because the
  return type changed.
- **Trade-off accepted:** for small tables (`< 200` rows) the two-step
  pattern is overhead. Kept it uniform anyway — the audit cost of
  remembering "paginate this one but not that one" outweighs the
  marginal latency on already-fast endpoints.
