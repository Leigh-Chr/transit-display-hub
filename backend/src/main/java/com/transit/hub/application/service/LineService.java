package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.infrastructure.persistence.LineRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LineService {

    private final LineRepository lineRepository;

    @Transactional(readOnly = true)
    public List<LineResponse> getAllLines() {
        return lineRepository.findAll().stream()
                .map(LineResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public LineResponse getLine(UUID id) {
        return lineRepository.findById(id)
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

        Line saved = lineRepository.save(line);
        return LineResponse.from(saved);
    }

    @Transactional
    public void deleteLine(UUID id) {
        if (!lineRepository.existsById(id)) {
            throw new EntityNotFoundException("Line", id);
        }
        lineRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Line getLineEntity(UUID id) {
        return lineRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Line", id));
    }
}
