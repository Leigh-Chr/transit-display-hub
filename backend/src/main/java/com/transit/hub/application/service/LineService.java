package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateLineRequest;
import com.transit.hub.application.dto.response.LineResponse;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.event.NetworkChangedEvent;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.util.ColorContrast;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
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

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class LineService {

    private final LineRepository lineRepository;
    private final ItineraryRepository itineraryRepository;
    private final ItineraryStopRepository itineraryStopRepository;
    private final ScheduleRepository scheduleRepository;
    private final BroadcastMessageRepository messageRepository;
    private final StopRepository stopRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<LineResponse> getAllLines() {
        return lineRepository.findAllWithStopsAndRoutes().stream()
                .map(LineResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public PageResponse<LineResponse> getAllLines(String search, Pageable pageable) {
        // Two-step: page over Line ids without JOIN FETCH (Hibernate
        // paginates in SQL), then hydrate only the page's entities with
        // their collections in a second query.
        Page<UUID> idsPage = (search != null && !search.isBlank())
                ? lineRepository.findIdsBySearch(search.trim(), pageable)
                : lineRepository.findAllIds(pageable);
        if (idsPage.getContent().isEmpty()) {
            return PageResponse.from(Page.empty(pageable), LineResponse::from);
        }
        List<Line> hydrated = lineRepository.findAllByIdInWithStopsAndRoutes(idsPage.getContent());
        // Preserve the page's order. The hydrate query uses IN (:ids)
        // which doesn't guarantee order.
        Map<UUID, Line> byId = hydrated.stream().collect(Collectors.toMap(Line::getId, l -> l));
        List<Line> ordered = idsPage.getContent().stream().map(byId::get).filter(java.util.Objects::nonNull).toList();
        Page<Line> page = new org.springframework.data.domain.PageImpl<>(ordered, pageable, idsPage.getTotalElements());
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
                .textColor(ColorContrast.readableTextColor(request.color()))
                .type(request.type())
                .build();

        Line saved = lineRepository.save(line);
        publishNetworkChanged(Set.of());
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

        boolean colorChanged = !line.getColor().equals(request.color());
        line.setCode(request.code());
        line.setName(request.name());
        line.setColor(request.color());
        if (colorChanged || line.getTextColor() == null) {
            // Re-derive on color change so the contrast stays in sync; fill in
            // when missing (rows imported before the column existed, or admin
            // creations that pre-dated this feature).
            line.setTextColor(ColorContrast.readableTextColor(request.color()));
        }
        line.setType(request.type());

        Line saved = lineRepository.save(line);
        publishNetworkChangedForLine(id);
        return LineResponse.from(saved);
    }

    @Transactional
    public void deleteLine(UUID id) {
        if (!lineRepository.existsById(id)) {
            throw new EntityNotFoundException("Line", id);
        }
        Set<UUID> affectedStopIds = getStopIdsForLine(id);
        // Delete related entities in dependency order. itinerary_stops has a FK
        // to itineraries without ON DELETE CASCADE, so it must be cleared before
        // the bulk delete on itineraries.
        scheduleRepository.deleteByItineraryLineId(id);
        itineraryStopRepository.deleteByItineraryLineId(id);
        itineraryRepository.deleteByLineId(id);
        messageRepository.deleteByScopeTypeAndScopeId(MessageScope.LINE, id);
        lineRepository.deleteById(id);
        publishNetworkChanged(affectedStopIds);
    }

    private void publishNetworkChangedForLine(UUID lineId) {
        Set<UUID> affectedStopIds = getStopIdsForLine(lineId);
        publishNetworkChanged(affectedStopIds);
    }

    private Set<UUID> getStopIdsForLine(UUID lineId) {
        return stopRepository.findByLineId(lineId).stream()
                .map(Stop::getId)
                .collect(Collectors.toSet());
    }

    private void publishNetworkChanged(Set<UUID> affectedStopIds) {
        eventPublisher.publishEvent(new NetworkChangedEvent(this, affectedStopIds));
    }
}
