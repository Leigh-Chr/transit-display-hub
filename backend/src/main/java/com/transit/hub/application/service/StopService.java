package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateStopRequest;
import com.transit.hub.application.dto.response.StopResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
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

    @Transactional(readOnly = true)
    public List<StopResponse> getAllStops() {
        return stopRepository.findAllWithLines().stream()
                .map(StopResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StopResponse> getStopsByLine(UUID lineId) {
        return stopRepository.findByLineIdWithLines(lineId).stream()
                .map(StopResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public StopResponse getStop(UUID id) {
        return stopRepository.findByIdWithLines(id)
                .map(StopResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));
    }

    @Transactional
    public StopResponse createStop(CreateStopRequest request) {
        Set<Line> lines = findAndValidateLines(request.lineIds());

        Stop stop = Stop.builder()
                .name(request.name())
                .lines(lines)
                .build();

        Stop saved = stopRepository.save(stop);
        return StopResponse.from(saved);
    }

    @Transactional
    public StopResponse updateStop(UUID id, CreateStopRequest request) {
        Stop stop = stopRepository.findByIdWithLines(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));

        Set<Line> lines = findAndValidateLines(request.lineIds());

        stop.setName(request.name());
        stop.getLines().clear();
        stop.getLines().addAll(lines);

        Stop saved = stopRepository.save(stop);
        return StopResponse.from(saved);
    }

    @Transactional
    public void deleteStop(UUID id) {
        if (!stopRepository.existsById(id)) {
            throw new EntityNotFoundException("Stop", id);
        }
        stopRepository.deleteById(id);
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
