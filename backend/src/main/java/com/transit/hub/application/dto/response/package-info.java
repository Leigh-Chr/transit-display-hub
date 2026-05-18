/**
 * REST response payloads — records returned by the controllers and
 * consumed by the Angular admin. {@code @NullMarked} makes every field
 * non-null by default; @Nullable flags the fields the wire serialises
 * as missing or null (Jackson skips them when omit-on-null is enabled,
 * the TS model keeps the field optional via {@code ?:}).
 */
@NullMarked
package com.transit.hub.application.dto.response;

import org.jspecify.annotations.NullMarked;
