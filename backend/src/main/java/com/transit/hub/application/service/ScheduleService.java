package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateTimedEntryRequest;
import com.transit.hub.application.dto.response.TimedEntryResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.event.ScheduleChangedEvent;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Route;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.TimedEntry;
import com.transit.hub.infrastructure.persistence.RouteRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TimedEntryRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class ScheduleService {

    private final TimedEntryRepository timedEntryRepository;
    private final StopRepository stopRepository;
    private final RouteRepository routeRepository;
    private final ApplicationEventPublisher eventPublisher;

    private static final DateTimeFormatter TIME_FORMATTER = DateTimeFormatter.ofPattern("HH:mm");

    @Transactional(readOnly = true)
    public List<TimedEntryResponse> getScheduleForStop(UUID stopId) {
        if (!stopRepository.existsById(stopId)) {
            throw new EntityNotFoundException("Stop", stopId);
        }
        return timedEntryRepository.findByStopIdWithRouteOrderByTime(stopId).stream()
                .map(TimedEntryResponse::from)
                .toList();
    }

    @Transactional
    public TimedEntryResponse createTimedEntry(UUID stopId, CreateTimedEntryRequest request) {
        Stop stop = stopRepository.findByIdWithLines(stopId)
                .orElseThrow(() -> new EntityNotFoundException("Stop", stopId));

        Route route = routeRepository.findByIdWithLine(request.routeId())
                .orElseThrow(() -> new EntityNotFoundException("Route", request.routeId()));

        Line line = route.getLine();

        // Validate that the route's line belongs to this stop
        if (!stop.getLines().contains(line)) {
            throw new IllegalArgumentException("Route's line " + line.getCode() + " is not associated with stop " + stop.getName());
        }

        LocalTime time = LocalTime.parse(request.time(), TIME_FORMATTER);

        // Check for duplicate entry
        if (timedEntryRepository.existsByStopIdAndRouteIdAndTime(stopId, route.getId(), time)) {
            throw new IllegalArgumentException(
                "A schedule entry already exists for route " + route.getName() +
                " at " + time.format(TIME_FORMATTER) + " at this stop");
        }

        TimedEntry entry = TimedEntry.builder()
                .time(time)
                .stop(stop)
                .route(route)
                .build();

        TimedEntry saved = timedEntryRepository.save(entry);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, stopId));
        return TimedEntryResponse.from(saved);
    }

    @Transactional
    public TimedEntryResponse updateTimedEntry(UUID id, CreateTimedEntryRequest request) {
        TimedEntry entry = timedEntryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TimedEntry", id));

        Stop stop = stopRepository.findByIdWithLines(entry.getStop().getId())
                .orElseThrow(() -> new EntityNotFoundException("Stop", entry.getStop().getId()));

        Route route = routeRepository.findByIdWithLine(request.routeId())
                .orElseThrow(() -> new EntityNotFoundException("Route", request.routeId()));

        Line line = route.getLine();

        // Validate that the route's line belongs to this stop
        if (!stop.getLines().contains(line)) {
            throw new IllegalArgumentException("Route's line " + line.getCode() + " is not associated with stop " + stop.getName());
        }

        LocalTime time = LocalTime.parse(request.time(), TIME_FORMATTER);

        // Check for duplicate entry (excluding the current one)
        if (timedEntryRepository.existsByStopIdAndRouteIdAndTimeExcludingId(
                stop.getId(), route.getId(), time, entry.getId())) {
            throw new IllegalArgumentException(
                "A schedule entry already exists for route " + route.getName() +
                " at " + time.format(TIME_FORMATTER) + " at this stop");
        }

        entry.setTime(time);
        entry.setRoute(route);

        TimedEntry saved = timedEntryRepository.save(entry);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, entry.getStop().getId()));
        return TimedEntryResponse.from(saved);
    }

    @Transactional
    public void deleteTimedEntry(UUID id) {
        TimedEntry entry = timedEntryRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("TimedEntry", id));

        UUID stopId = entry.getStop().getId();
        timedEntryRepository.delete(entry);
        eventPublisher.publishEvent(new ScheduleChangedEvent(this, stopId));
    }
}
