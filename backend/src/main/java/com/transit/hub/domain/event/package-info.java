/**
 * Domain events published through Spring's {@code ApplicationEventPublisher}
 * — network changes, stop deletions, message broadcasts. {@code @NullMarked}
 * keeps the event payloads honest: a listener that receives the event
 * knows its fields are populated unless an explicit {@code @Nullable}
 * is declared.
 */
@NullMarked
package com.transit.hub.domain.event;

import org.jspecify.annotations.NullMarked;
