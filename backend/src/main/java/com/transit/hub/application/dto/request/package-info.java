/**
 * Request DTOs consumed by the REST controllers. {@code @NullMarked}
 * lines up with the Bean Validation contract: a field without
 * {@code @Nullable} is non-null at deserialisation time and the
 * Jakarta validator rejects missing values before the handler body.
 */
@NullMarked
package com.transit.hub.application.dto.request;

import org.jspecify.annotations.NullMarked;
