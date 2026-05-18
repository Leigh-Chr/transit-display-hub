package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.CreateMessageRequest;
import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.exception.ValidationException;
import com.transit.hub.application.support.UnpaginatedCap;
import com.transit.hub.domain.event.MessageChangedEvent;
import com.transit.hub.domain.model.BroadcastMessage;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageScope;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.persistence.BroadcastMessageRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.MessageSpecifications;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.websocket.ActiveDisplayTracker;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.jspecify.annotations.Nullable;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class MessageService {

    private final BroadcastMessageRepository messageRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ApplicationEventPublisher eventPublisher;
    private final MessageScopeResolver scopeResolver;
    private final ActiveDisplayTracker activeDisplayTracker;
    private final Clock clock;

    @Transactional(readOnly = true)
    public List<MessageResponse> getAllMessages() {
        // broadcast_messages is the one bound-less table flagged in
        // audit 2026-05-12 P2 — every other findAll caller reads a
        // GTFS-bounded source. The cap fails loud (via log warn)
        // long before the result set risks heap pressure.
        return toResponses(UnpaginatedCap.findAllCapped(
                messageRepository, log, "MessageService.getAllMessages"));
    }

    @Transactional(readOnly = true)
    public List<MessageResponse> getActiveMessages() {
        return toResponses(messageRepository.findActiveMessages(Instant.now(clock)));
    }

    @Transactional(readOnly = true)
    public PageResponse<MessageResponse> getAllMessages(@Nullable Boolean active, @Nullable MessageSeverity severity, @Nullable String search, Pageable pageable) {
        Instant now = Instant.now(clock);
        boolean hasSearch = search != null && !search.isBlank();
        String trimmedSearch = (search != null && !search.isBlank()) ? search.trim() : null;

        // Build a composite specification; (root, q, cb) -> null is the JPA
        // "match everything" predicate and avoids the Specification.where(null)
        // method-reference ambiguity introduced by JpaSpecificationExecutor's
        // sibling interfaces in recent Spring Data versions.
        Specification<BroadcastMessage> spec = (root, query, cb) -> null;
        if (Boolean.TRUE.equals(active)) {
            spec = spec.and(MessageSpecifications.active(now));
        }
        if (severity != null) {
            spec = spec.and(MessageSpecifications.hasSeverity(severity));
        }
        if (hasSearch) {
            spec = spec.and(MessageSpecifications.textMatches(
                    java.util.Objects.requireNonNull(trimmedSearch)));
        }

        Page<BroadcastMessage> page = messageRepository.findAll(spec, pageable);
        // Pre-load scope names in two bulk queries (one for lines, one for stops)
        // so the per-message scope lookup in toResponse no longer adds N round-trips.
        Map<UUID, String> lineNames = scopeResolver.bulkLineNames(page.getContent());
        Map<UUID, String> stopNames = scopeResolver.bulkStopNames(page.getContent());
        return PageResponse.from(page, msg -> scopeResolver.toResponse(msg, lineNames, stopNames));
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
        assertAuthorizedForScope(request.scopeType());

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
        if (!affectedStops.isEmpty() && saved.isActiveAt(Instant.now(clock))) {
            eventPublisher.publishEvent(new MessageChangedEvent(this, affectedStops));
        }

        return toResponse(saved);
    }

    @Transactional
    public MessageResponse updateMessage(UUID id, CreateMessageRequest request) {
        BroadcastMessage message = messageRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Message", id));

        validateMessageRequest(request);
        // Block agents both from promoting a message into NETWORK scope and from
        // editing one that already has it.
        assertAuthorizedForScope(request.scopeType());
        assertAuthorizedForScope(message.getScopeType());

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

        assertAuthorizedForScope(message.getScopeType());

        Set<UUID> affectedStops = getAffectedStopIds(message);
        messageRepository.delete(message);

        if (!affectedStops.isEmpty()) {
            eventPublisher.publishEvent(new MessageChangedEvent(this, affectedStops));
        }
    }

    /**
     * NETWORK-scope messages are network-wide announcements visible on every
     * kiosk; only admins may create, modify or delete them. LINE/STOP scopes
     * remain available to agents.
     */
    private void assertAuthorizedForScope(MessageScope scope) {
        if (scope != MessageScope.NETWORK) {
            return;
        }
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAdmin = auth != null && auth.getAuthorities().stream()
                .anyMatch(a -> "ROLE_ADMIN".equals(a.getAuthority()));
        if (!isAdmin) {
            throw new AccessDeniedException(
                    "Only administrators can create, modify or delete network-wide messages");
        }
    }

    private void validateMessageRequest(CreateMessageRequest request) {
        if (request.startTime().isAfter(request.endTime())) {
            throw ValidationException.ofKey("error.message.startBeforeEnd");
        }

        switch (request.scopeType()) {
            case NETWORK:
                if (request.scopeId() != null) {
                    throw ValidationException.ofKey("error.message.scopeIdNullForNetwork");
                }
                break;
            case LINE:
                if (request.scopeId() == null) {
                    throw ValidationException.ofKey("error.message.scopeIdRequiredForLine");
                }
                if (!lineRepository.existsById(request.scopeId())) {
                    throw new EntityNotFoundException("Line", request.scopeId());
                }
                break;
            case STOP:
                if (request.scopeId() == null) {
                    throw ValidationException.ofKey("error.message.scopeIdRequiredForStop");
                }
                if (!stopRepository.existsById(request.scopeId())) {
                    throw new EntityNotFoundException("Stop", request.scopeId());
                }
                break;
            default:
                break;
        }
    }

    private Set<UUID> getAffectedStopIds(BroadcastMessage message) {
        return switch (message.getScopeType()) {
            // For a network-wide message only the kiosks that are currently
            // connected will consume the push; pre-intersecting here avoids
            // the full findAllIds() call and the downstream fan-out over
            // every stop in the database.
            case NETWORK -> activeDisplayTracker.getActiveStopIds();
            // LINE / STOP scopes always carry a non-null scope id (the create /
            // update validators guarantee it); requireNonNull surfaces a bug
            // loud and clear if that invariant ever breaks.
            case LINE -> stopRepository.findByLineId(
                            java.util.Objects.requireNonNull(message.getScopeId())).stream()
                    .map(Stop::getId)
                    .collect(Collectors.toSet());
            case STOP -> Set.of(java.util.Objects.requireNonNull(message.getScopeId()));
        };
    }

    private MessageResponse toResponse(BroadcastMessage message) {
        // Delegating to the shared resolver keeps a single code path for
        // scope name resolution: it also short-circuits the lookup when
        // the scope is NETWORK and reuses the bulk-friendly signature so
        // a future caller that resolves a batch only needs a one-line
        // change. The single-message list materialisation costs nothing
        // (one HashMap allocation) compared to the two SELECTs the
        // private duplicate used to issue.
        List<BroadcastMessage> single = List.of(message);
        return scopeResolver.toResponse(
                message,
                scopeResolver.bulkLineNames(single),
                scopeResolver.bulkStopNames(single)
        );
    }

    private List<MessageResponse> toResponses(List<BroadcastMessage> messages) {
        Map<UUID, String> lineNames = scopeResolver.bulkLineNames(messages);
        Map<UUID, String> stopNames = scopeResolver.bulkStopNames(messages);
        return messages.stream()
                .map(msg -> scopeResolver.toResponse(msg, lineNames, stopNames))
                .toList();
    }
}
