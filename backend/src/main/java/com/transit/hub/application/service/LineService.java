package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LineService {

    private final LineRepository lineRepository;
    private final ItineraryRepository itineraryRepository;
    private final ScheduleRepository scheduleRepository;
    private final BroadcastMessageRepository messageRepository;

    @Transactional(readOnly = true)
    public List<LineResponse> getAllLines() {
        return lineRepository.findAllWithStopsAndRoutes().stream()
                .map(LineResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<LineResponse> getAllLines(String search, Pageable pageable) {
        Page<Line> page;
        if (search != null && !search.isBlank()) {
            page = lineRepository.findBySearchWithStopsAndRoutes(search.trim(), pageable);
        } else {
            page = lineRepository.findAllWithStopsAndRoutes(pageable);
        }
        return PageResponse.from(page, LineResponse::from);
    }

    @Transactional(readOnly = true)
    public LineResponse getLine(UUID id) {
        return lineRepository.findByIdWithStopsAndRoutes(id)
                .map(LineResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Line", id));
    }

    @Transactional
    public LineResponse createLine(CreateLineRequest request) {
        if (lineRepository.existsByCode(request.code())) {
            throw new ValidationException("Line with code '" + request.code() + "' already exists");
        }

        Line line = Line.builder()
                .code(request.code())
                .name(request.name())
                .color(request.color())
                .type(request.type())
                .build();

        Line saved = lineRepository.save(line);
        return LineResponse.from(saved);
    }

    @Transactional
    public LineResponse updateLine(UUID id, CreateLineRequest request) {
        Line line = lineRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Line", id));

        // Check if code is being changed to an existing code
        if (!line.getCode().equals(request.code()) && lineRepository.existsByCode(request.code())) {
            throw new ValidationException("Line with code '" + request.code() + "' already exists");
        }

        line.setCode(request.code());
        line.setName(request.name());
        line.setColor(request.color());
        line.setType(request.type());

        Line saved = lineRepository.save(line);
        return LineResponse.from(saved);
    }

    @Transactional
    public void deleteLine(UUID id) {
        if (!lineRepository.existsById(id)) {
            throw new EntityNotFoundException("Line", id);
        }
        // Delete related entities in correct order
        scheduleRepository.deleteByItineraryLineId(id);
        itineraryRepository.deleteByLineId(id);
        messageRepository.deleteByScopeTypeAndScopeId(MessageScope.LINE, id);
        lineRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Line getLineEntity(UUID id) {
        return lineRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Line", id));
    }
}
