package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateStopRequest;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.dto.response.StopResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.support.Pages;
import com.transit.hub.application.support.UnpaginatedCap;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.event.StopDeletedEvent;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.ItineraryStopRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class StopService {

    private final StopRepository stopRepository;
    private final LineRepository lineRepository;
    private final ScheduleRepository scheduleRepository;
    private final ItineraryStopRepository itineraryStopRepository;
    private final DeviceRepository deviceRepository;
    private final BroadcastMessageRepository messageRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<StopResponse> getAllStops() {
        // Defensive cap (audit P1 B-7): route the unpaginated read path
        // through the paginated implementation with a one-page cap so a
        // future feed with 30k stops does not blow memory on this
        // endpoint. Operators see a warning when the cap fires.
        PageResponse<StopResponse> page = getAllStops(null, null,
                PageRequest.of(0, UnpaginatedCap.MAX_ROWS));
        if (page.totalPages() > 1) {
            log.warn("getAllStops() capped at {} rows (totalElements={}); switch to the paginated endpoint",
                    UnpaginatedCap.MAX_ROWS, page.totalElements());
        }
        return page.content();
    }

    @Transactional(readOnly = true)
    public List<StopResponse> getStopsByLine(UUID lineId) {
        List<Stop> stops = stopRepository.findByLineIdWithLinesAndDevices(lineId);
        Map<UUID, Integer> counts = scheduleCountsFor(stops);
        return stops.stream()
                .map(stop -> StopResponse.from(stop, counts.getOrDefault(stop.getId(), 0)))
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<StopResponse> getAllStops(UUID lineId, String search, Pageable pageable) {
        boolean hasLineId = lineId != null;
        boolean hasSearch = search != null && !search.isBlank();
        String trimmedSearch = hasSearch ? search.trim() : null;

        // Two-step pagination — page over Stop ids without a collection
        // JOIN FETCH so Hibernate paginates in SQL, then hydrate only
        // the page's entities with lines + devices.
        Page<UUID> idsPage;
        if (hasLineId && hasSearch) {
            idsPage = stopRepository.findIdsByLineIdAndSearch(lineId, trimmedSearch, pageable);
        } else if (hasLineId) {
            idsPage = stopRepository.findIdsByLineId(lineId, pageable);
        } else if (hasSearch) {
            idsPage = stopRepository.findIdsBySearch(trimmedSearch, pageable);
        } else {
            idsPage = stopRepository.findAllIds(pageable);
        }
        if (idsPage.getContent().isEmpty()) {
            return PageResponse.from(Page.<Stop>empty(pageable),
                    stop -> StopResponse.from(stop, 0));
        }
        List<Stop> hydrated = stopRepository.findAllByIdInWithLinesAndDevices(idsPage.getContent());
        Page<Stop> page = Pages.hydrate(idsPage, hydrated, Stop::getId);

        Map<UUID, Integer> counts = scheduleCountsFor(page.getContent());
        return PageResponse.from(page,
                stop -> StopResponse.from(stop, counts.getOrDefault(stop.getId(), 0)));
    }

    /**
     * Single bulk SELECT against `schedules` rather than a lazy `getSchedules().size()`
     * call per row, which would otherwise be a guaranteed N+1.
     */
    private Map<UUID, Integer> scheduleCountsFor(List<Stop> stops) {
        if (stops.isEmpty()) {
            return Map.of();
        }
        List<UUID> ids = stops.stream().map(Stop::getId).toList();
        Map<UUID, Integer> counts = new HashMap<>();
        for (Object[] row : scheduleRepository.countByStopIdIn(ids)) {
            counts.put((UUID) row[0], ((Number) row[1]).intValue());
        }
        return counts;
    }

    @Transactional(readOnly = true)
    public StopResponse getStop(UUID id) {
        return stopRepository.findByIdWithLinesAndDevices(id)
                .map(StopResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));
    }

    @Transactional
    public StopResponse createStop(CreateStopRequest request) {
        Set<Line> lines = findAndValidateLines(request.lineIds());

        Stop stop = Stop.builder()
                .name(request.name())
                .latitude(request.latitude())
                .longitude(request.longitude())
                .lines(lines)
                .build();

        Stop saved = stopRepository.save(stop);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, Set.of(saved.getId())));
        return StopResponse.from(saved);
    }

    @Transactional
    public StopResponse updateStop(UUID id, CreateStopRequest request) {
        Stop stop = stopRepository.findByIdWithLines(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));

        Set<Line> lines = findAndValidateLines(request.lineIds());

        stop.setName(request.name());
        stop.setLatitude(request.latitude());
        stop.setLongitude(request.longitude());
        stop.setLines(lines);

        Stop saved = stopRepository.save(stop);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, Set.of(saved.getId())));
        return StopResponse.from(saved);
    }

    @Transactional
    public void deleteStop(UUID id) {
        Stop stop = stopRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));
        String stopName = stop.getName();

        // Delete related entities in correct order
        scheduleRepository.deleteByStopId(id);
        itineraryStopRepository.deleteByStopId(id);
        // Devices and messages
        deviceRepository.deleteByStopId(id);
        messageRepository.deleteByScopeTypeAndScopeId(MessageScope.STOP, id);
        stopRepository.deleteById(id);
        // Notify kiosks subscribed to this stop that their state is final.
        eventPublisher.publishEvent(new StopDeletedEvent(this, id, stopName));
        eventPublisher.publishEvent(new NetworkChangedEvent(this, Set.of(id)));
    }

    private Set<Line> findAndValidateLines(Set<UUID> lineIds) {
        Set<Line> lines = new HashSet<>();
        for (UUID lineId : lineIds) {
            Line line = lineRepository.findById(lineId)
                    .orElseThrow(() -> new EntityNotFoundException("Line", lineId));
            lines.add(line);
        }
        return lines;
    }
}
