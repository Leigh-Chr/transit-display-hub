package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.enums.MessageSeverity;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.Locale;

/** JPA Specification factories for {@link BroadcastMessage} filtering.
 *  Compose with {@code Specification.where(null).and(...)} in the service. */
public final class MessageSpecifications {

    private MessageSpecifications() {}

    /** Messages whose validity window contains {@code now}
     *  (startTime &le; now &lt; endTime, matching the half-open contract in
     *  {@link BroadcastMessage#isActiveAt(Instant)}). */
    public static Specification<BroadcastMessage> active(Instant now) {
        return (root, query, cb) -> cb.and(
                cb.lessThanOrEqualTo(root.get("startTime"), now),
                cb.greaterThan(root.get("endTime"), now)
        );
    }

    public static Specification<BroadcastMessage> hasSeverity(MessageSeverity severity) {
        return (root, query, cb) -> cb.equal(root.get("severity"), severity);
    }

    /** Case-insensitive substring match on title or content. */
    public static Specification<BroadcastMessage> textMatches(String search) {
        return (root, query, cb) -> {
            String pattern = "%" + search.toLowerCase(Locale.ROOT) + "%";
            return cb.or(
                    cb.like(cb.lower(root.get("title")), pattern),
                    cb.like(cb.lower(root.get("content")), pattern)
            );
        };
    }
}
