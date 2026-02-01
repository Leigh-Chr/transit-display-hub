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

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class StopService {

    private final StopRepository stopRepository;
    private final LineRepository lineRepository;

    @Transactional(readOnly = true)
    public List<StopResponse> getAllStops() {
        return stopRepository.findAllWithLine().stream()
                .map(StopResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<StopResponse> getStopsByLine(UUID lineId) {
        return stopRepository.findByLineIdWithLine(lineId).stream()
                .map(StopResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public StopResponse getStop(UUID id) {
        return stopRepository.findById(id)
                .map(StopResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));
    }

    @Transactional
    public StopResponse createStop(CreateStopRequest request) {
        Line line = lineRepository.findById(request.lineId())
                .orElseThrow(() -> new EntityNotFoundException("Line", request.lineId()));

        Stop stop = Stop.builder()
                .name(request.name())
                .line(line)
                .build();

        Stop saved = stopRepository.save(stop);
        return StopResponse.from(saved);
    }

    @Transactional
    public StopResponse updateStop(UUID id, CreateStopRequest request) {
        Stop stop = stopRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));

        Line line = lineRepository.findById(request.lineId())
                .orElseThrow(() -> new EntityNotFoundException("Line", request.lineId()));

        stop.setName(request.name());
        stop.setLine(line);

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
        return stopRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Stop", id));
    }
}
