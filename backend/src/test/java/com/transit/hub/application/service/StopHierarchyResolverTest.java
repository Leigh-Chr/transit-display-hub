package com.transit.hub.application.service;

import com.transit.hub.domain.model.Stop;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("StopHierarchyResolver")
class StopHierarchyResolverTest {

    private final StopHierarchyResolver resolver = new StopHierarchyResolver();

    @Test
    @DisplayName("buildPlatformToParentMap maps every child platform to its parent station")
    void buildPlatformToParentMap_mapsChildrenToParent() {
        Stop parent = stopWithId(UUID.randomUUID(), null);
        Stop platformA = stopWithId(UUID.randomUUID(), parent);
        Stop platformB = stopWithId(UUID.randomUUID(), parent);
        Stop orphan = stopWithId(UUID.randomUUID(), null);

        Map<UUID, UUID> map = resolver.buildPlatformToParentMap(
                List.of(parent, platformA, platformB, orphan));

        assertThat(map).containsOnly(
                Map.entry(platformA.getId(), parent.getId()),
                Map.entry(platformB.getId(), parent.getId()));
    }

    @Test
    @DisplayName("buildPlatformToParentMap is empty when no stop has a parent")
    void buildPlatformToParentMap_emptyForOrphansOnly() {
        Stop leafA = stopWithId(UUID.randomUUID(), null);
        Stop leafB = stopWithId(UUID.randomUUID(), null);

        Map<UUID, UUID> map = resolver.buildPlatformToParentMap(List.of(leafA, leafB));

        assertThat(map).isEmpty();
    }

    @Test
    @DisplayName("buildChildrenByParentId groups children under their parent station id")
    void buildChildrenByParentId_groupsChildrenUnderParent() {
        Stop parent = stopWithId(UUID.randomUUID(), null);
        Stop platformA = stopWithId(UUID.randomUUID(), parent);
        Stop platformB = stopWithId(UUID.randomUUID(), parent);

        Map<UUID, List<Stop>> map = resolver.buildChildrenByParentId(
                List.of(parent, platformA, platformB));

        assertThat(map.get(parent.getId())).containsExactlyInAnyOrder(platformA, platformB);
    }

    @Test
    @DisplayName("buildChildrenByParentId is empty for stops without a parent")
    void buildChildrenByParentId_returnsEmptyForLeafStops() {
        Stop leaf = stopWithId(UUID.randomUUID(), null);

        Map<UUID, List<Stop>> map = resolver.buildChildrenByParentId(List.of(leaf));

        assertThat(map).isEmpty();
    }

    private Stop stopWithId(UUID id, Stop parent) {
        Stop stop = new Stop();
        stop.setId(id);
        stop.setParentStop(parent);
        return stop;
    }
}
