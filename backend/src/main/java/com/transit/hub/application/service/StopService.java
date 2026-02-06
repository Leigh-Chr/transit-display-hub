package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateStopRequest;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.dto.response.StopResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.ItineraryStopRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
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
        return stopRepository.findAllWithLinesAndDevices().stream()
                .map(StopResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StopResponse> getStopsByLine(UUID lineId) {
        return stopRepository.findByLineIdWithLinesAndDevices(lineId).stream()
                .map(StopResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<StopResponse> getAllStops(UUID lineId, String search, Pageable pageable) {
        Page<Stop> page;
        boolean hasLineId = lineId != null;
        boolean hasSearch = search != null && !search.isBlank();
        String trimmedSearch = hasSearch ? search.trim() : null;

        if (hasLineId && hasSearch) {
            page = stopRepository.findByLineIdAndSearchWithLinesAndDevices(lineId, trimmedSearch, pageable);
        } else if (hasLineId) {
            page = stopRepository.findByLineIdWithLinesAndDevices(lineId, pageable);
        } else if (hasSearch) {
            page = stopRepository.findBySearchWithLinesAndDevices(trimmedSearch, pageable);
        } else {
            page = stopRepository.findAllWithLinesAndDevices(pageable);
        }
        return PageResponse.from(page, StopResponse::from);
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
        stop.getLines().clear();
        stop.getLines().addAll(lines);

        Stop saved = stopRepository.save(stop);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, Set.of(saved.getId())));
        return StopResponse.from(saved);
    }

    @Transactional
    public void deleteStop(UUID id) {
        if (!stopRepository.existsById(id)) {
            throw new EntityNotFoundException("Stop", id);
        }
        // Delete related entities in correct order
        scheduleRepository.deleteByStopId(id);
        itineraryStopRepository.deleteByStopId(id);
        // Devices and messages
        deviceRepository.deleteByStopId(id);
        messageRepository.deleteByScopeTypeAndScopeId(MessageScope.STOP, id);
        stopRepository.deleteById(id);
        eventPublisher.publishEvent(new NetworkChangedEvent(this, Set.of(id)));
    }

    @Transactional(readOnly = true)
    public Stop getStopEntity(UUID id) {
        return stopRepository.findByIdWithLines(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));
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
