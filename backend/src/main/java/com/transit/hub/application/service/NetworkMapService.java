package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.Bounds;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkLine;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkStop;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkTransfer;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.Transfer;
import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TransferRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class NetworkMapService {

    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final TransferRepository transferRepository;
    private final ScheduleRepository scheduleRepository;
    private final FlexStopTimeRepository flexStopTimeRepository;
    private final AreaRepository areaRepository;
    private final StopHierarchyResolver stopHierarchyResolver;

    @Value("${app.data-loader.gtfs.attribution:}")
    private String attribution;

    @Cacheable("networkMap")
    @Transactional(readOnly = true)
    public NetworkMapResponse getNetworkMap() {
        List<Line> lines = lineRepository.findAllWithItineraryStops();
        List<Stop> stops = stopRepository.findAllWithLines();
        List<Transfer> transfers = transferRepository.findAllWithStops();

        Map<UUID, UUID> platformToParentId = stopHierarchyResolver.buildPlatformToParentMap(stops);
        Map<UUID, Long> scheduleCountByLineId = buildScheduleCountByLine();
        List<NetworkLine> networkLines = lines.stream()
                .map(line -> toNetworkLine(line,
                        scheduleCountByLineId.getOrDefault(line.getId(), 0L),
                        platformToParentId))
                .toList();

        Set<UUID> onDemandStopIds = collectOnDemandStopIds();
        Map<UUID, List<String>> areaNamesByStopId = buildAreaNamesByStopId();
        Map<UUID, List<Stop>> childrenByParentId = stopHierarchyResolver.buildChildrenByParentId(stops);
        List<NetworkStop> networkStops = buildNetworkStops(stops, childrenByParentId,
                onDemandStopIds, areaNamesByStopId);
        List<NetworkTransfer> networkTransfers = buildNetworkTransfers(transfers,
                platformToParentId, lines);

        Bounds bounds = calculateBounds(networkStops);
        String attr = attribution == null || attribution.isBlank() ? null : attribution;
        return new NetworkMapResponse(networkLines, networkStops, networkTransfers, bounds, attr);
    }

    /** Single COUNT(*) GROUP BY query so the per-line lookup stays O(1). */
    private Map<UUID, Long> buildScheduleCountByLine() {
        Map<UUID, Long> result = new HashMap<>();
        for (Object[] row : scheduleRepository.countByLineId()) {
            result.put((UUID) row[0], (Long) row[1]);
        }
        return result;
    }

    /** Stops with at least one on-request schedule, merged with stops
     *  referenced by a flex_stop_times row. Both queries run once per
     *  cache miss. Mockito returns null when not stubbed, hence the
     *  defensive guards. */
    private Set<UUID> collectOnDemandStopIds() {
        Set<UUID> ids = new HashSet<>();
        Set<UUID> scheduled = scheduleRepository.findStopIdsWithOnDemandPickup();
        Set<UUID> flex = flexStopTimeRepository.findStopIdsTouchedByFlex();
        if (scheduled != null) { ids.addAll(scheduled); }
        if (flex != null) { ids.addAll(flex); }
        return ids;
    }

    /** Stop UUID → sorted list of Fares v2 area names. Built once per
     *  cache miss from a single fetch-with-stops query so the popup
     *  side never triggers N+1. Empty when the feed shipped no
     *  areas.txt. */
    private Map<UUID, List<String>> buildAreaNamesByStopId() {
        Map<UUID, List<String>> map = new HashMap<>();
        List<Area> areas = areaRepository.findAllWithStops();
        if (areas == null) {
            return map;
        }
        for (Area area : areas) {
            String name = area.getName() != null ? area.getName() : area.getExternalId();
            if (name == null) {
                continue;
            }
            for (Stop s : area.getStops()) {
                map.computeIfAbsent(s.getId(), k -> new ArrayList<>()).add(name);
            }
        }
        for (List<String> names : map.values()) {
            Collections.sort(names);
        }
        return map;
    }

    /** Surface stops = parent stations + free-standing platforms.
     *  Platforms with a parent disappear into their parent. */
    private List<NetworkStop> buildNetworkStops(List<Stop> stops,
                                                 Map<UUID, List<Stop>> childrenByParentId,
                                                 Set<UUID> onDemandStopIds,
                                                 Map<UUID, List<String>> areaNamesByStopId) {
        List<NetworkStop> out = new ArrayList<>();
        for (Stop s : stops) {
            if (s.getParentStop() != null) {
                continue;
            }
            out.add(toNetworkStop(s, childrenByParentId.get(s.getId()),
                    onDemandStopIds, areaNamesByStopId));
        }
        return out;
    }

    /** Transfers between platforms collapse to transfers between their
     *  parents; intra-station transfers (same parent both ends) drop
     *  off the map. The dedupe key adds the resolved route qualifiers
     *  so multiple transfers.txt entries for the same stop pair (one
     *  generic + one route-specific) coexist instead of squashing each
     *  other. */
    private List<NetworkTransfer> buildNetworkTransfers(List<Transfer> transfers,
                                                         Map<UUID, UUID> platformToParentId,
                                                         List<Line> lines) {
        Map<String, UUID> lineIdByExternalId = new HashMap<>();
        for (Line l : lines) {
            if (l.getExternalId() != null) {
                lineIdByExternalId.put(l.getExternalId(), l.getId());
            }
        }
        Set<List<Object>> seen = new HashSet<>();
        List<NetworkTransfer> out = new ArrayList<>();
        for (Transfer t : transfers) {
            UUID from = platformToParentId.getOrDefault(t.getFromStop().getId(), t.getFromStop().getId());
            UUID to = platformToParentId.getOrDefault(t.getToStop().getId(), t.getToStop().getId());
            if (from.equals(to)) {
                continue;
            }
            UUID fromLineId = t.getFromRouteId() == null ? null : lineIdByExternalId.get(t.getFromRouteId());
            UUID toLineId = t.getToRouteId() == null ? null : lineIdByExternalId.get(t.getToRouteId());
            List<Object> key = Arrays.asList(from, to,
                    fromLineId == null ? "" : fromLineId,
                    toLineId == null ? "" : toLineId);
            if (!seen.add(key)) {
                continue;
            }
            out.add(new NetworkTransfer(from, to, t.getTransferType(),
                    t.getMinTransferTime(), fromLineId, toLineId));
        }
        return out;
    }

    private NetworkLine toNetworkLine(Line line, long scheduleCount,
                                       Map<UUID, UUID> platformToParentId) {
        List<Itinerary> sortedItineraries = line.getItineraries().stream()
                .sorted(Comparator.comparing(Itinerary::getName))
                .toList();

        List<List<UUID>> itineraries = new ArrayList<>();

        for (Itinerary itinerary : sortedItineraries) {
            List<ItineraryStop> orderedStops = itinerary.getItineraryStops().stream()
                    .sorted(Comparator.comparing(ItineraryStop::getPosition))
                    .toList();

            if (orderedStops.isEmpty()) {
                continue;
            }

            // Remap each platform UUID to its parent's UUID when one
            // exists, then dedupe consecutive duplicates that the
            // collapse can introduce (multiple platforms of the same
            // station appearing in sequence on a trip).
            List<UUID> stopIds = new ArrayList<>(orderedStops.size());
            UUID lastEmitted = null;
            for (ItineraryStop is : orderedStops) {
                UUID rawId = is.getStop().getId();
                UUID surfaceId = platformToParentId.getOrDefault(rawId, rawId);
                if (!surfaceId.equals(lastEmitted)) {
                    stopIds.add(surfaceId);
                    lastEmitted = surfaceId;
                }
            }
            itineraries.add(stopIds);
        }

        return new NetworkLine(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor(),
                line.getTextColor(),
                line.getType(),
                line.getCategory(),
                itineraries,
                scheduleCount
        );
    }

    private NetworkStop toNetworkStop(Stop stop, List<Stop> children,
                                       Set<UUID> onDemandStopIds,
                                       Map<UUID, List<String>> areaNamesByStopId) {
        // Union of own lines + children's lines, deduped + sorted.
        // Pre-Phase 1.3 a parent station carried its own lines via the
        // schedule collapse; post-Phase 1.3 parents are bare and the
        // children own the line bindings — so the union covers both
        // shapes without a special case.
        Set<String> codeSet = new java.util.LinkedHashSet<>();
        for (Line line : stop.getLines()) {
            codeSet.add(line.getCode());
        }
        if (children != null) {
            for (Stop child : children) {
                for (Line line : child.getLines()) {
                    codeSet.add(line.getCode());
                }
            }
        }
        List<String> lineCodes = codeSet.stream().sorted().toList();

        // hasOnDemand: stop or any of its children has on-request
        // schedules. Same OR over the children for wheelchair, with
        // a small priority tweak — a parent's own ACCESSIBLE wins over
        // a NOT_ACCESSIBLE child (operator entered the parent value
        // explicitly), but a NULL parent inherits the most accessible
        // child so the filter doesn't hide stations that have at least
        // one accessible quay.
        boolean hasOnDemand = onDemandStopIds.contains(stop.getId());
        WheelchairAccess wheelchair = stop.getWheelchairBoarding();
        if (children != null) {
            for (Stop child : children) {
                if (onDemandStopIds.contains(child.getId())) {
                    hasOnDemand = true;
                }
                if (wheelchair == null && child.getWheelchairBoarding() != null) {
                    wheelchair = child.getWheelchairBoarding();
                } else if (wheelchair == WheelchairAccess.NOT_ACCESSIBLE
                        && child.getWheelchairBoarding() == WheelchairAccess.ACCESSIBLE) {
                    wheelchair = WheelchairAccess.ACCESSIBLE;
                }
            }
        }

        // Area names: own + children's, deduped + sorted. Same union
        // pattern as line codes — Phase 1.3 may have stop_areas attach
        // to platforms while the parent (the surface node on the map)
        // gets nothing on its own row.
        Set<String> areaSet = new java.util.LinkedHashSet<>();
        List<String> ownAreas = areaNamesByStopId.get(stop.getId());
        if (ownAreas != null) {areaSet.addAll(ownAreas);}
        if (children != null) {
            for (Stop child : children) {
                List<String> childAreas = areaNamesByStopId.get(child.getId());
                if (childAreas != null) {areaSet.addAll(childAreas);}
            }
        }
        List<String> fareAreaNames = areaSet.stream().sorted().toList();

        return new NetworkStop(
                stop.getId(),
                stop.getName(),
                stop.getLatitude(),
                stop.getLongitude(),
                stop.getSchematicX(),
                stop.getSchematicY(),
                lineCodes,
                wheelchair,
                hasOnDemand,
                fareAreaNames
        );
    }

    private Bounds calculateBounds(List<NetworkStop> stops) {
        if (stops.isEmpty()) {
            return new Bounds(0, 0, 100, 100);
        }

        // Determine which coordinate system to use: if any stop has schematic coords, use schematic for all
        boolean useSchematic = stops.stream()
                .anyMatch(s -> s.schematicX() != null && s.schematicY() != null);

        double minX = Double.MAX_VALUE;
        double minY = Double.MAX_VALUE;
        double maxX = -Double.MAX_VALUE;
        double maxY = -Double.MAX_VALUE;

        for (NetworkStop stop : stops) {
            Double x = useSchematic ? stop.schematicX() : stop.longitude();
            Double y = useSchematic ? stop.schematicY() : stop.latitude();

            if (x != null && y != null) {
                minX = Math.min(minX, x);
                minY = Math.min(minY, y);
                maxX = Math.max(maxX, x);
                maxY = Math.max(maxY, y);
            }
        }

        if (minX == Double.MAX_VALUE) {
            return new Bounds(0, 0, 100, 100);
        }

        return new Bounds(minX, minY, maxX, maxY);
    }
}
