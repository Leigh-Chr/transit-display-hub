/**
 * REST controllers — the HTTP surface of the application. {@code @NullMarked}
 * keeps the contract honest: a {@code @PathVariable} or {@code @RequestParam}
 * declared without {@code @Nullable} is non-null by construction, so Spring's
 * binder rejects the missing case before it reaches the handler body.
 */
@NullMarked
package com.transit.hub.api.rest;

import org.jspecify.annotations.NullMarked;
