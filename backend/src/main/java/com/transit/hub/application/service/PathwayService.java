package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.PathwayResponse;
import com.transit.hub.application.dto.response.StationPathwayGraphResponse;
import com.transit.hub.application.dto.response.StationPathwayGraphResponse.LevelInfo;
import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PathwayService {

    private final PathwayRepository pathwayRepository;
    private final StationLevelRepository stationLevelRepository;
    private final StopRepository stopRepository;

    /**
     * Returns the indoor pathway graph rooted at a station — pathways
     * touching either the given stop OR any of its sibling platforms
     * under the same parent station, plus the level rows of the
     * station. Used by the stop-popup to surface indoor connections.
     * <p>
     * When the stop has no parent (free-standing), the graph is the
     * stop's own pathways.
     */
    @Transactional(readOnly = true)
    public Optional<StationPathwayGraphResponse> findStationGraphForStop(UUID stopId) {
        return stopRepository.findById(stopId).map(stop -> {
            Stop station = stop.getParentStop() != null ? stop.getParentStop() : stop;
            UUID stationId = station.getId();

            List<LevelInfo> levels = stationLevelRepository
                    .findByParentStopIdOrderByLevelIndex(stationId).stream()
                    .map(LevelInfo::from)
                    .toList();

            // Pathways touching the station's siblings (children of the
            // station, plus the station itself when location_type=1).
            List<UUID> stopIds = new ArrayList<>(
                    stopRepository.findChildIds(stationId));
            stopIds.add(stationId);

            List<PathwayResponse> pathways = pathwayRepository.findTouchingAny(stopIds).stream()
                    .sorted(Comparator
                            .comparing((Pathway p) -> p.getPathwayMode().ordinal())
                            .thenComparing(p -> p.getSignpostedAs() == null ? "" : p.getSignpostedAs()))
                    .map(PathwayResponse::from)
                    .toList();

            return new StationPathwayGraphResponse(
                    stationId,
                    station.getName(),
                    levels,
                    pathways
            );
        });
    }
}

