/**
 * Cross-cutting helpers shared by the application services — pagination
 * caps, page-shape factories, message scope resolvers. {@code @NullMarked}
 * matches the {@code application.service} convention so an inadvertent
 * nullable leak between a service and a helper surfaces at compile time.
 */
@NullMarked
package com.transit.hub.application.support;

import org.jspecify.annotations.NullMarked;
