package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.PathwayResponse;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class PathwayService {

    private final PathwayRepository pathwayRepository;

    /**
     * Returns every pathway with at least one endpoint at the given
     * stop, ordered first by {@code from→to direction} (out-of-the-stop
     * first), then by {@code pathway_mode} so escalators / stairs cluster
     * predictably in the admin view.
     */
    @Transactional(readOnly = true)
    public List<PathwayResponse> findPathwaysForStop(UUID stopId) {
        return pathwayRepository.findTouchingStop(stopId).stream()
                .sorted(Comparator
                        .comparing((com.transit.hub.domain.model.Pathway p) ->
                                stopId.equals(p.getFromStop().getId()) ? 0 : 1)
                        .thenComparing(p -> p.getPathwayMode().ordinal())
                        .thenComparing(p -> p.getSignpostedAs() == null ? "" : p.getSignpostedAs()))
                .map(PathwayResponse::from)
                .toList();
    }
}
