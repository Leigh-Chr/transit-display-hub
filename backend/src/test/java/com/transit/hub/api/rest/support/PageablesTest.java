package com.transit.hub.api.rest.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;

import static org.assertj.core.api.Assertions.assertThat;

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
}
