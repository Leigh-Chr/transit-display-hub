package com.transit.hub.api.rest.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DisplayName("Pageables")
class PageablesTest {

    @Test
    @DisplayName("from() builds an ascending Pageable when sortDir is 'asc'")
    void ascending() {
        Pageable p = Pageables.from(0, 10, "name", "asc");

        assertThat(p.getPageNumber()).isZero();
        assertThat(p.getPageSize()).isEqualTo(10);
        Sort.Order order = p.getSort().getOrderFor("name");
        assertThat(order).isNotNull();
        assertThat(order.isAscending()).isTrue();
    }

    @Test
    @DisplayName("from() builds a descending Pageable when sortDir is 'desc'")
    void descending() {
        Pageable p = Pageables.from(2, 25, "createdAt", "desc");

        assertThat(p.getPageNumber()).isEqualTo(2);
        assertThat(p.getPageSize()).isEqualTo(25);
        Sort.Order order = p.getSort().getOrderFor("createdAt");
        assertThat(order).isNotNull();
        assertThat(order.isDescending()).isTrue();
    }

    @Test
    @DisplayName("from() is case-insensitive on sortDir")
    void caseInsensitive() {
        Pageable p = Pageables.from(0, 10, "name", "DESC");

        assertThat(p.getSort().getOrderFor("name").isDescending()).isTrue();
    }

    @Test
    @DisplayName("from() falls back to ascending when sortDir is unrecognised")
    void unknownSortDirDefaultsToAsc() {
        Pageable p = Pageables.from(0, 10, "name", "wat");

        assertThat(p.getSort().getOrderFor("name").isAscending()).isTrue();
    }

    @Test
    @DisplayName("from() falls back to ascending when sortDir is null")
    void nullSortDirDefaultsToAsc() {
        Pageable p = Pageables.from(0, 10, "name", null);

        assertThat(p.getSort().getOrderFor("name").isAscending()).isTrue();
    }

    @Test
    @DisplayName("fromWhitelisted() rejects a sortBy field not in the whitelist")
    void rejectsSortByOutsideWhitelist() {
        Set<String> allowed = Set.of("name", "createdAt");
        assertThatThrownBy(() ->
            Pageables.fromWhitelisted(0, 10, "password", "asc", allowed, "name")
        ).isInstanceOf(IllegalArgumentException.class)
         .hasMessageContaining("password");
    }

    @Test
    @DisplayName("fromWhitelisted() accepts a sortBy field present in the whitelist")
    void allowsSortByInWhitelist() {
        Set<String> allowed = Set.of("name", "createdAt");
        Pageable p = Pageables.fromWhitelisted(0, 10, "name", "desc", allowed, "createdAt");
        assertThat(p.getSort().getOrderFor("name")).isNotNull();
        assertThat(p.getSort().getOrderFor("name").isDescending()).isTrue();
    }

    @Test
    @DisplayName("fromWhitelisted() falls back to the default field when sortBy is null or blank")
    void usesDefaultWhenSortByIsNullOrBlank() {
        Set<String> allowed = Set.of("name", "createdAt");
        Pageable p = Pageables.fromWhitelisted(0, 10, null, "asc", allowed, "createdAt");
        assertThat(p.getSort().getOrderFor("createdAt")).isNotNull();

        Pageable p2 = Pageables.fromWhitelisted(0, 10, "  ", "asc", allowed, "createdAt");
        assertThat(p2.getSort().getOrderFor("createdAt")).isNotNull();
    }
}
