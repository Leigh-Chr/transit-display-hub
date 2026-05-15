package com.transit.hub.api.rest.support;

import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

/**
 * Small builder for {@link Pageable} from the {@code page / size / sortBy / sortDir}
 * query string quartet that every paginated admin endpoint accepts. Defaults to
 * ascending order when {@code sortDir} is {@code null} or anything other than
 * {@code "desc"} (case-insensitive).
 */
public final class Pageables {

    /** Hard cap so {@code ?size=10_000_000} cannot DoS the JPA layer. */
    public static final int MAX_PAGE_SIZE = 200;

    private Pageables() {
    }

    public static Pageable from(int page, int size, String sortBy, String sortDir) {
        Sort sort = "desc".equalsIgnoreCase(sortDir)
                ? Sort.by(sortBy).descending()
                : Sort.by(sortBy).ascending();
        return PageRequest.of(Math.max(page, 0), clampSize(size), sort);
    }

    private static int clampSize(int size) {
        if (size <= 0) { return 1; }
        return Math.min(size, MAX_PAGE_SIZE);
    }

    public static Pageable fromWhitelisted(int page, int size, String sortBy, String sortDir,
                                           Set<String> allowedFields, String defaultField) {
        String effective = (sortBy == null || sortBy.isBlank()) ? defaultField : sortBy;
        if (!allowedFields.contains(effective)) {
            throw new IllegalArgumentException(
                "Invalid sortBy '" + effective + "'. Allowed: " + allowedFields);
        }
        return from(page, size, effective, sortDir);
    }
}
