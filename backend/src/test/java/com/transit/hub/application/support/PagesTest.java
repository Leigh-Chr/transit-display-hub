package com.transit.hub.application.support;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Pages.hydrate")
class PagesTest {

    private record Item(UUID id, String label) {}

    @Test
    @DisplayName("preserves the order of idsPage even when hydrated arrives shuffled")
    void preservesIdsOrder() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        UUID c = UUID.randomUUID();
        Page<UUID> idsPage = new PageImpl<>(List.of(a, b, c), PageRequest.of(0, 10), 3);
        List<Item> hydrated = List.of(new Item(c, "C"), new Item(a, "A"), new Item(b, "B"));

        Page<Item> result = Pages.hydrate(idsPage, hydrated, Item::id);

        assertThat(result.getContent()).extracting(Item::label).containsExactly("A", "B", "C");
        assertThat(result.getTotalElements()).isEqualTo(3);
    }

    @Test
    @DisplayName("drops ids missing from hydrated without throwing")
    void dropsMissingHydratedRows() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();
        // pageSize=2 keeps PageImpl's recalculation rule out of the way so
        // total stays exactly what we passed in.
        Page<UUID> idsPage = new PageImpl<>(List.of(a, b), PageRequest.of(0, 2), 5);
        // 'b' was deleted between the two queries — hydrated only carries 'a'.
        List<Item> hydrated = List.of(new Item(a, "A"));

        Page<Item> result = Pages.hydrate(idsPage, hydrated, Item::id);

        assertThat(result.getContent()).extracting(Item::label).containsExactly("A");
        assertThat(result.getTotalElements()).isEqualTo(5);
    }

    @Test
    @DisplayName("returns an empty page when hydrated is empty")
    void emptyHydratedReturnsEmptyPage() {
        Page<UUID> idsPage = new PageImpl<>(List.of(UUID.randomUUID()), PageRequest.of(0, 10), 1);

        Page<Item> result = Pages.hydrate(idsPage, List.of(), Item::id);

        assertThat(result.getContent()).isEmpty();
        assertThat(result.getTotalElements()).isEqualTo(1);
    }
}
