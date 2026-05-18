/**
 * Security wiring at the API boundary — authentication entry points,
 * authorization helpers consumed by {@code @PreAuthorize}, current-user
 * resolvers. {@code @NullMarked} forces every "authenticated principal"
 * path to opt-in to {@code @Nullable} when the absence is legitimate
 * (anonymous endpoints, public broadcasts).
 */
@NullMarked
package com.transit.hub.api.security;

import org.jspecify.annotations.NullMarked;
