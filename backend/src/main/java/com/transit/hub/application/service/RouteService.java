package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateRouteRequest;
import com.transit.hub.application.dto.response.RouteResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Route;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.RouteRepository;
import com.transit.hub.infrastructure.persistence.TimedEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class RouteService {

    private final RouteRepository routeRepository;
    private final LineRepository lineRepository;
    private final TimedEntryRepository timedEntryRepository;

    @Transactional(readOnly = true)
    public List<RouteResponse> getAllRoutes() {
        return routeRepository.findAllWithLine().stream()
                .map(RouteResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public RouteResponse getRoute(UUID id) {
        return routeRepository.findByIdWithLine(id)
                .map(RouteResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Route", id));
    }

    @Transactional(readOnly = true)
    public List<RouteResponse> getRoutesByLine(UUID lineId) {
        if (!lineRepository.existsById(lineId)) {
            throw new EntityNotFoundException("Line", lineId);
        }
        return routeRepository.findByLineIdWithLine(lineId).stream()
                .map(RouteResponse::from)
                .toList();
    }

    @Transactional
    public RouteResponse createRoute(CreateRouteRequest request) {
        Line line = lineRepository.findById(request.lineId())
                .orElseThrow(() -> new EntityNotFoundException("Line", request.lineId()));

        if (routeRepository.existsByLineIdAndName(request.lineId(), request.name())) {
            throw new ValidationException("Route with name '" + request.name() + "' already exists for line " + line.getCode());
        }

        Route route = Route.builder()
                .line(line)
                .name(request.name())
                .terminusName(request.terminusName())
                .build();

        Route saved = routeRepository.save(route);
        return RouteResponse.from(saved);
    }

    @Transactional
    public RouteResponse updateRoute(UUID id, CreateRouteRequest request) {
        Route route = routeRepository.findByIdWithLine(id)
                .orElseThrow(() -> new EntityNotFoundException("Route", id));

        Line line = lineRepository.findById(request.lineId())
                .orElseThrow(() -> new EntityNotFoundException("Line", request.lineId()));

        // Check if name is being changed to an existing name on the same line
        if (routeRepository.existsByLineIdAndNameExcludingId(request.lineId(), request.name(), id)) {
            throw new ValidationException("Route with name '" + request.name() + "' already exists for line " + line.getCode());
        }

        route.setLine(line);
        route.setName(request.name());
        route.setTerminusName(request.terminusName());

        Route saved = routeRepository.save(route);
        return RouteResponse.from(saved);
    }

    @Transactional
    public void deleteRoute(UUID id) {
        if (!routeRepository.existsById(id)) {
            throw new EntityNotFoundException("Route", id);
        }
        // Delete related timed entries first
        timedEntryRepository.deleteByRouteId(id);
        routeRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Route getRouteEntity(UUID id) {
        return routeRepository.findByIdWithLine(id)
                .orElseThrow(() -> new EntityNotFoundException("Route", id));
    }
}
