/**
 * Spring Data repositories and the JPA Specifications backing them.
 * {@code @NullMarked} aligns the {@code Optional<T>} return types
 * with the project's null-safety contract — a missing row is
 * {@code Optional.empty()}, never a bare {@code null}.
 */
@NullMarked
package com.transit.hub.infrastructure.persistence;

import org.jspecify.annotations.NullMarked;
