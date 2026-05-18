/**
 * STOMP/WebSocket plumbing — authentication interceptors, broker
 * configuration, device heartbeat sink. {@code @NullMarked} aligns the
 * package with the rest of the codebase; Spring's WebSocket contracts
 * carry their own JSpecify metadata, so overrides explicitly mirror
 * the {@code @Nullable} markers from the framework where applicable.
 */
@NullMarked
package com.transit.hub.infrastructure.websocket;

import org.jspecify.annotations.NullMarked;
