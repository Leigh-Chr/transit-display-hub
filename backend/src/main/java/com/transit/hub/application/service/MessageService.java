package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateMessageRequest;
import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MessageService {

    private final BroadcastMessageRepository messageRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ApplicationEventPublisher eventPublisher;

    @Transactional(readOnly = true)
    public List<MessageResponse> getAllMessages() {
        return messageRepository.findAll().stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getActiveMessages() {
        return messageRepository.findActiveMessages(Instant.now()).stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MessageResponse getMessage(UUID id) {
        return messageRepository.findById(id)
                .map(this::toResponse)
                .orElseThrow(() -> new EntityNotFoundException("Message", id));
    }

    @Transactional
    public MessageResponse createMessage(CreateMessageRequest request) {
        validateMessageRequest(request);

        BroadcastMessage message = BroadcastMessage.builder()
                .title(request.title())
                .content(request.content())
                .severity(request.severity())
                .startTime(request.startTime())
                .endTime(request.endTime())
                .scopeType(request.scopeType())
                .scopeId(request.scopeId())
                .build();

        BroadcastMessage saved = messageRepository.save(message);

        // Publish event for affected stops
        Set<UUID> affectedStops = getAffectedStopIds(saved);
        if (!affectedStops.isEmpty() && saved.isActive()) {
            eventPublisher.publishEvent(new MessageChangedEvent(this, affectedStops));
        }

        return toResponse(saved);
    }

    @Transactional
    public MessageResponse updateMessage(UUID id, CreateMessageRequest request) {
        BroadcastMessage message = messageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Message", id));

        validateMessageRequest(request);

        // Track original affected stops for event
        Set<UUID> originalAffectedStops = getAffectedStopIds(message);

        message.setTitle(request.title());
        message.setContent(request.content());
        message.setSeverity(request.severity());
        message.setStartTime(request.startTime());
        message.setEndTime(request.endTime());
        message.setScopeType(request.scopeType());
        message.setScopeId(request.scopeId());

        BroadcastMessage saved = messageRepository.save(message);

        // Combine original and new affected stops
        Set<UUID> newAffectedStops = getAffectedStopIds(saved);
        Set<UUID> allAffectedStops = new HashSet<>();
        allAffectedStops.addAll(originalAffectedStops);
        allAffectedStops.addAll(newAffectedStops);

        if (!allAffectedStops.isEmpty()) {
            eventPublisher.publishEvent(new MessageChangedEvent(this, allAffectedStops));
        }

        return toResponse(saved);
    }

    @Transactional
    public void deleteMessage(UUID id) {
        BroadcastMessage message = messageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Message", id));

        Set<UUID> affectedStops = getAffectedStopIds(message);
        messageRepository.delete(message);

        if (!affectedStops.isEmpty()) {
            eventPublisher.publishEvent(new MessageChangedEvent(this, affectedStops));
        }
    }

    private void validateMessageRequest(CreateMessageRequest request) {
        if (request.startTime().isAfter(request.endTime())) {
            throw new ValidationException("Start time must be before end time");
        }

        switch (request.scopeType()) {
            case NETWORK:
                if (request.scopeId() != null) {
                    throw new ValidationException("Scope ID must be null for NETWORK scope");
                }
                break;
            case LINE:
                if (request.scopeId() == null) {
                    throw new ValidationException("Scope ID is required for LINE scope");
                }
                if (!lineRepository.existsById(request.scopeId())) {
                    throw new EntityNotFoundException("Line", request.scopeId());
                }
                break;
            case STOP:
                if (request.scopeId() == null) {
                    throw new ValidationException("Scope ID is required for STOP scope");
                }
                if (!stopRepository.existsById(request.scopeId())) {
                    throw new EntityNotFoundException("Stop", request.scopeId());
                }
                break;
        }
    }

    private Set<UUID> getAffectedStopIds(BroadcastMessage message) {
        return switch (message.getScopeType()) {
            case NETWORK -> stopRepository.findAll().stream()
                    .map(Stop::getId)
                    .collect(Collectors.toSet());
            case LINE -> stopRepository.findByLineId(message.getScopeId()).stream()
                    .map(Stop::getId)
                    .collect(Collectors.toSet());
            case STOP -> Set.of(message.getScopeId());
        };
    }

    private MessageResponse toResponse(BroadcastMessage message) {
        MessageResponse.ScopeInfo scopeInfo = null;

        if (message.getScopeType() == MessageScope.LINE && message.getScopeId() != null) {
            lineRepository.findById(message.getScopeId()).ifPresent(line ->
                    // Note: We can't reassign scopeInfo here, so we'll return inline
                    {}
            );
            Line line = lineRepository.findById(message.getScopeId()).orElse(null);
            if (line != null) {
                scopeInfo = new MessageResponse.ScopeInfo(line.getName(), line.getCode(), line.getColor());
            }
        } else if (message.getScopeType() == MessageScope.STOP && message.getScopeId() != null) {
            Stop stop = stopRepository.findByIdWithLines(message.getScopeId()).orElse(null);
            if (stop != null) {
                // Use first line for display purposes
                Line firstLine = stop.getLines().stream()
                        .min(java.util.Comparator.comparing(Line::getCode))
                        .orElse(null);
                if (firstLine != null) {
                    scopeInfo = new MessageResponse.ScopeInfo(
                            stop.getName(),
                            firstLine.getCode(),
                            firstLine.getColor()
                    );
                } else {
                    scopeInfo = new MessageResponse.ScopeInfo(stop.getName(), null, null);
                }
            }
        }

        return MessageResponse.from(message, scopeInfo);
    }
}
