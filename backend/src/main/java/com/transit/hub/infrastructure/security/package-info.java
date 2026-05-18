/**
 * Spring Security wiring — filters, JWT lifecycle, refresh tokens,
 * rate-limit guards, bootstrap of the initial admin user.
 * {@code @NullMarked} so optional values (cookies, headers, parsed
 * tokens) are flagged explicitly with
 * {@link org.jspecify.annotations.Nullable}.
 */
@NullMarked
package com.transit.hub.infrastructure.security;

import org.jspecify.annotations.NullMarked;
