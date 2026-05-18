/**
 * JPA entities forming the domain model. {@code @NullMarked} flips the
 * default — every type in this package is assumed non-null unless an
 * explicit {@code @Nullable} says otherwise. NullAway then reads the
 * annotations to gate any nullable value leaking into a non-null hole
 * at compile time.
 */
@NullMarked
package com.transit.hub.domain.model;

import org.jspecify.annotations.NullMarked;
