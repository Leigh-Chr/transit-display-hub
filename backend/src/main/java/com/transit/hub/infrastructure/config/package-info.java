/**
 * Spring configuration beans — clock, auth properties, CORS, caches.
 * {@code @NullMarked} pins the bean exposure to the same convention
 * as the rest of {@code infrastructure}; the framework rarely hands
 * us a nullable bean, but when it does the {@code @Nullable} marker
 * makes the contract visible.
 */
@NullMarked
package com.transit.hub.infrastructure.config;

import org.jspecify.annotations.NullMarked;
