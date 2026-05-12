package com.transit.hub.application.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.slf4j.Logger;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UnpaginatedCap.findAllCapped")
class UnpaginatedCapTest {

    @SuppressWarnings("unchecked")
    @Mock
    private JpaRepository<String, Long> repository;

    @Mock
    private Logger log;

    @Test
    void issuesAPageableThatMatchesTheConstantCap() {
        when(repository.findAll(any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of("a", "b"), PageRequest.of(0, UnpaginatedCap.MAX_ROWS), 2));

        UnpaginatedCap.findAllCapped(repository, Sort.unsorted(), log, "test");

        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(captor.capture());
        Pageable issued = captor.getValue();
        assertThat(issued.getPageSize()).isEqualTo(UnpaginatedCap.MAX_ROWS);
        assertThat(issued.getPageNumber()).isZero();
    }

    @Test
    void returnsTheFullPageContentWhenTotalElementsIsBelowTheCap() {
        Page<String> page = new PageImpl<>(List.of("a", "b", "c"),
                PageRequest.of(0, UnpaginatedCap.MAX_ROWS), 3);
        when(repository.findAll(any(Pageable.class))).thenReturn(page);

        List<String> result = UnpaginatedCap.findAllCapped(repository, log, "below-cap");

        assertThat(result).containsExactly("a", "b", "c");
        verify(log, never()).warn(any(), any(), any(), any());
    }

    @Test
    void logsAWarningWhenTheCapWasReachedAndMoreRowsExist() {
        // 1 001 simulated rows: the page returns the first 1 000, totalElements claims 1 001 → hasNext = true.
        List<String> capped = java.util.Collections.nCopies(UnpaginatedCap.MAX_ROWS, "row");
        Page<String> page = new PageImpl<>(capped,
                PageRequest.of(0, UnpaginatedCap.MAX_ROWS), UnpaginatedCap.MAX_ROWS + 1L);
        when(repository.findAll(any(Pageable.class))).thenReturn(page);

        List<String> result = UnpaginatedCap.findAllCapped(repository, log, "capped");

        assertThat(result).hasSize(UnpaginatedCap.MAX_ROWS);
        verify(log).warn(any(String.class), any(), any(), any());
    }
}
