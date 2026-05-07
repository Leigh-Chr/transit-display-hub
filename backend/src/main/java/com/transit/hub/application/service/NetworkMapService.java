package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertMessage;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.Bounds;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkLine;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkStop;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkTransfer;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.Transfer;
import com.transit.hub.domain.model.Area;
import com.transit.hub.domain.model.enums.WheelchairAccess;
import com.transit.hub.infrastructure.persistence.AreaRepository;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TransferRepository;
import com.transit.hub.infrastructure.websocket.ActiveDisplayTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class NetworkMapService {

    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final BroadcastMessageRepository broadcastMessageRepository;
    private final TransferRepository transferRepository;
    private final ScheduleRepository scheduleRepository;
    private final AreaRepository areaRepository;
    private final CacheManager cacheManager;
    private final SimpMessagingTemplate messagingTemplate;
    private final ActiveDisplayTracker activeDisplayTracker;

    @Value("${app.data-loader.gtfs.attribution:}")
    private String attribution;

    @Cacheable("networkMap")
    @Transactional(readOnly = true)
    public NetworkMapResponse getNetworkMap() {
        List<Line> lines = lineRepository.findAllWithItineraryStops();
        List<Stop> stops = stopRepository.findAllWithLines();
        List<Transfer> transfers = transferRepository.findAllWithStops();

        // Map<lineId, scheduleCount> built from a single COUNT(*)
        // GROUP BY query so the per-line lookup below stays O(1).
        Map<UUID, Long> scheduleCountByLineId = new HashMap<>();
        for (Object[] row : scheduleRepository.countByLineId()) {
            scheduleCountByLineId.put((UUID) row[0], (Long) row[1]);
        }
        List<NetworkLine> networkLines = lines.stream()
                .map(line -> toNetworkLine(line, scheduleCountByLineId.getOrDefault(line.getId(), 0L)))
                .toList();

        // Phase 1.3 ripple: the importer now persists every platform plus
        // its parent station as separate rows. The schematic map should
        // still show ONE node per logical stop, so we collapse children
        // back into their parent at render time. Standalone stops (no
        // parent) keep rendering as themselves; parent stations gather
        // the union of their children's line codes since lines attach
        // to platforms after Phase 1.3, not to the parent.
        Map<UUID, List<Stop>> childrenByParentId = new HashMap<>();
        for (Stop s : stops) {
            if (s.getParentStop() != null) {
                childrenByParentId.computeIfAbsent(s.getParentStop().getId(), k -> new ArrayList<>()).add(s);
            }
        }
        // Set of stops with at least one on-request schedule. The
        // single query happens once per cache miss; the set lookup is
        // O(1) per stop. For parent stations we OR the parent's own
        // value with each child's so a TAD platform "lights up" its
        // parent on the map. Guard against the null fallback Mockito's
        // default for Set returns gives in tests that don't stub it.
        Set<UUID> onDemandStopIds = scheduleRepository.findStopIdsWithOnDemandPickup();
        if (onDemandStopIds == null) {onDemandStopIds = Set.of();}

        // Reverse map: stop UUID → sorted list of Fares v2 area names.
        // Built once per cache miss from a single fetch-with-stops query
        // so the popup-side display doesn't trigger N+1. Empty when the
        // feed didn't ship areas.txt; the popup hides the zone pill in
        // that case. Defensive null check matches the onDemand pattern
        // for tests that don't stub the repo explicitly.
        Map<UUID, List<String>> areaNamesByStopId = new HashMap<>();
        List<Area> areas = areaRepository.findAllWithStops();
        if (areas != null) {
            for (Area area : areas) {
                String name = area.getName() != null ? area.getName() : area.getExternalId();
                if (name == null) {continue;}
                for (Stop s : area.getStops()) {
                    areaNamesByStopId.computeIfAbsent(s.getId(), k -> new ArrayList<>()).add(name);
                }
            }
            for (List<String> names : areaNamesByStopId.values()) {
                Collections.sort(names);
            }
        }

        // Surface stops = parent stations + free-standing platforms.
        // Platforms with a parent disappear into their parent.
        Map<UUID, UUID> platformToParentId = new HashMap<>();
        List<NetworkStop> networkStops = new ArrayList<>();
        for (Stop s : stops) {
            if (s.getParentStop() != null) {
                platformToParentId.put(s.getId(), s.getParentStop().getId());
                continue;
            }
            networkStops.add(toNetworkStop(s, childrenByParentId.get(s.getId()),
                    onDemandStopIds, areaNamesByStopId));
        }

        // Transfers between platforms collapse to transfers between their
        // parents; intra-station transfers (same parent both ends) drop
        // off the map since they're walking inside a single node.
        Set<List<UUID>> seenTransfers = new HashSet<>();
        List<NetworkTransfer> networkTransfers = new ArrayList<>();
        for (Transfer t : transfers) {
            UUID from = platformToParentId.getOrDefault(t.getFromStop().getId(), t.getFromStop().getId());
            UUID to = platformToParentId.getOrDefault(t.getToStop().getId(), t.getToStop().getId());
            if (from.equals(to)) {continue;}
            if (!seenTransfers.add(List.of(from, to))) {continue;}
            networkTransfers.add(new NetworkTransfer(from, to, t.getTransferType(), t.getMinTransferTime()));
        }

        Bounds bounds = calculateBounds(networkStops);

        String attr = attribution == null || attribution.isBlank() ? null : attribution;
        return new NetworkMapResponse(networkLines, networkStops, networkTransfers, bounds, attr);
    }

    @Cacheable("networkAlerts")
    @Transactional(readOnly = true)
    public AlertsResponse getAlerts() {
        List<BroadcastMessage> activeMessages = broadcastMessageRepository.findActiveMessages(Instant.now());
        if (activeMessages.isEmpty()) {
            return new AlertsResponse(List.of(), Map.of(), Map.of());
        }

        List<AlertMessage> networkAlerts = new ArrayList<>();
        Map<UUID, List<AlertMessage>> lineAlerts = new HashMap<>();
        Map<UUID, List<AlertMessage>> stopAlerts = new HashMap<>();

        for (BroadcastMessage message : activeMessages) {
            var alertMsg = new AlertMessage(message.getTitle(), message.getContent(), message.getSeverity());

            switch (message.getScopeType()) {
                case NETWORK -> networkAlerts.add(alertMsg);
                case LINE -> lineAlerts.computeIfAbsent(message.getScopeId(), k -> new ArrayList<>()).add(alertMsg);
                case STOP -> stopAlerts.computeIfAbsent(message.getScopeId(), k -> new ArrayList<>()).add(alertMsg);
                default -> { /* no action for unknown scope types */ }
            }
        }

        return new AlertsResponse(networkAlerts, lineAlerts, stopAlerts);
    }

    private NetworkLine toNetworkLine(Line line, long scheduleCount) {
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

            itineraries.add(orderedStops.stream()
                    .map(is -> is.getStop().getId())
                    .toList());
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

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onNetworkChanged(NetworkChangedEvent event) {
        try {
            evictCache("networkMap");
            evictCache("networkAlerts");
        } catch (Exception e) {
            if (log.isWarnEnabled()) {
                log.warn("Failed to evict cache on network change: {}", e.getMessage());
            }
        }
        pushNetworkMapUpdate();
    }

    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT)
    public void onMessageChanged(MessageChangedEvent event) {
        try {
            evictCache("networkAlerts");
        } catch (Exception e) {
            if (log.isWarnEnabled()) {
                log.warn("Failed to evict cache on message change: {}", e.getMessage());
            }
        }
        pushAlertsUpdate();
    }

    private void pushNetworkMapUpdate() {
        // Skip the recompute + serialize entirely when nobody is watching.
        // The cache invalidation already happened, so the next consumer will
        // get a fresh response on first GET anyway.
        if (!activeDisplayTracker.hasNetworkMapSubscribers()) {
            log.debug("Skipping network map push — no active subscribers");
            return;
        }
        try {
            NetworkMapResponse networkMap = getNetworkMap();
            AlertsResponse alerts = getAlerts();
            Object payload = Map.of("type", "FULL_UPDATE", "networkMap", networkMap, "alerts", alerts);
            messagingTemplate.convertAndSend("/topic/network-map", payload);
            log.debug("Pushed network map update via WebSocket");
        } catch (Exception e) {
            log.error("Failed to push network map update", e);
        }
    }

    private void pushAlertsUpdate() {
        if (!activeDisplayTracker.hasNetworkMapSubscribers()) {
            log.debug("Skipping alerts push — no active subscribers");
            return;
        }
        try {
            AlertsResponse alerts = getAlerts();
            Object payload = Map.of("type", "ALERTS_UPDATE", "alerts", alerts);
            messagingTemplate.convertAndSend("/topic/network-map", payload);
            log.debug("Pushed alerts update via WebSocket");
        } catch (Exception e) {
            log.error("Failed to push alerts update", e);
        }
    }

    private void evictCache(String cacheName) {
        var cache = cacheManager.getCache(cacheName);
        if (cache != null) {
            cache.clear();
        }
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
