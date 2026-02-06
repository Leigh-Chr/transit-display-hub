package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.NetworkMapResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertMessage;
import com.transit.hub.application.dto.response.NetworkMapResponse.AlertsResponse;
import com.transit.hub.application.dto.response.NetworkMapResponse.Bounds;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkLine;
import com.transit.hub.application.dto.response.NetworkMapResponse.NetworkStop;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.cache.CacheManager;
import org.springframework.cache.annotation.Cacheable;
import org.springframework.context.event.EventListener;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class NetworkMapService {

    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final BroadcastMessageRepository broadcastMessageRepository;
    private final CacheManager cacheManager;

    @Cacheable("networkMap")
    @Transactional(readOnly = true)
    public NetworkMapResponse getNetworkMap() {
        List<Line> lines = lineRepository.findAllWithItineraryStops();
        List<Stop> stops = stopRepository.findAllWithLines();

        List<NetworkLine> networkLines = lines.stream()
                .map(this::toNetworkLine)
                .toList();

        List<NetworkStop> networkStops = stops.stream()
                .map(this::toNetworkStop)
                .toList();

        Bounds bounds = calculateBounds(networkStops);

        return new NetworkMapResponse(networkLines, networkStops, bounds);
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
            }
        }

        return new AlertsResponse(networkAlerts, lineAlerts, stopAlerts);
    }

    private NetworkLine toNetworkLine(Line line) {
        List<Itinerary> sortedItineraries = line.getItineraries().stream()
                .sorted(Comparator.comparing(Itinerary::getName))
                .toList();

        List<List<UUID>> itineraries = new ArrayList<>();

        for (Itinerary itinerary : sortedItineraries) {
            List<ItineraryStop> orderedStops = itinerary.getItineraryStops().stream()
                    .sorted(Comparator.comparing(ItineraryStop::getPosition))
                    .toList();

            if (orderedStops.isEmpty()) continue;

            itineraries.add(orderedStops.stream()
                    .map(is -> is.getStop().getId())
                    .toList());
        }

        return new NetworkLine(
                line.getId(),
                line.getCode(),
                line.getName(),
                line.getColor(),
                line.getType(),
                itineraries
        );
    }

    private NetworkStop toNetworkStop(Stop stop) {
        List<String> lineCodes = stop.getLines().stream()
                .map(Line::getCode)
                .sorted()
                .toList();

        return new NetworkStop(
                stop.getId(),
                stop.getName(),
                stop.getLatitude(),
                stop.getLongitude(),
                stop.getSchematicX(),
                stop.getSchematicY(),
                lineCodes
        );
    }

    @EventListener
    public void onNetworkChanged(NetworkChangedEvent event) {
        evictCache("networkMap");
        evictCache("networkAlerts");
    }

    @EventListener
    public void onMessageChanged(MessageChangedEvent event) {
        evictCache("networkAlerts");
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
