/**
 * Cross-cutting observability plumbing — request correlation,
 * MDC enrichment, custom Micrometer meters. {@code @NullMarked} so
 * NullAway flags the rare optional field (HTTP header values, MDC
 * reads) explicitly with {@link org.jspecify.annotations.Nullable}.
 */
@NullMarked
package com.transit.hub.infrastructure.observability;

import org.jspecify.annotations.NullMarked;
