package com.transit.hub.api.rest;

import com.transit.hub.api.rest.support.Pageables;
import com.transit.hub.application.dto.request.CreateMessageRequest;
import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.application.dto.response.PageResponse;
import com.transit.hub.application.service.MessageService;
import com.transit.hub.domain.model.enums.MessageSeverity;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Set;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
@Tag(name = "Administration — messages",
     description = "Messages d'information diffusés sur les écrans publics (réseau, ligne, ou arrêt).")
public class MessageController {

    private static final Set<String> ALLOWED_MESSAGE_SORTS = Set.of("severity", "startTime", "endTime");

    private final MessageService messageService;

    @GetMapping
    public ResponseEntity<PageResponse<MessageResponse>> getMessages(
            @RequestParam(required = false) Boolean active,
            @RequestParam(required = false) MessageSeverity severity,
            @RequestParam(required = false, defaultValue = "0") Integer page,
            @RequestParam(required = false, defaultValue = "10") Integer size,
            @RequestParam(required = false, defaultValue = "startTime") String sortBy,
            @RequestParam(required = false, defaultValue = "desc") String sortDir,
            @RequestParam(required = false) String search
    ) {
        Pageable pageable = Pageables.fromWhitelisted(page, size, sortBy, sortDir,
                ALLOWED_MESSAGE_SORTS, "startTime");
        return ResponseEntity.ok(messageService.getAllMessages(active, severity, search, pageable));
    }

    /**
     * Non-paginated companion for callers that want the entire list
     * (dashboard, real-time push). Honours the {@code active=true}
     * shortcut for the active-only stream. Capped by
     * {@code UnpaginatedCap} so a runaway feed cannot DoS the response.
     */
    @GetMapping("/all")
    public ResponseEntity<List<MessageResponse>> getAllMessagesUnpaginated(
            @RequestParam(required = false) Boolean active
    ) {
        if (active != null && active) {
            return ResponseEntity.ok(messageService.getActiveMessages());
        }
        return ResponseEntity.ok(messageService.getAllMessages());
    }

    @GetMapping("/{id}")
    public ResponseEntity<MessageResponse> getMessage(@PathVariable UUID id) {
        return ResponseEntity.ok(messageService.getMessage(id));
    }

    @PostMapping
    public ResponseEntity<MessageResponse> createMessage(@Valid @RequestBody CreateMessageRequest request) {
        MessageResponse created = messageService.createMessage(request);
        return ResponseEntity.status(HttpStatus.CREATED).body(created);
    }

    @PutMapping("/{id}")
    public ResponseEntity<MessageResponse> updateMessage(
            @PathVariable UUID id,
            @Valid @RequestBody CreateMessageRequest request
    ) {
        return ResponseEntity.ok(messageService.updateMessage(id, request));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteMessage(@PathVariable UUID id) {
        messageService.deleteMessage(id);
        return ResponseEntity.noContent().build();
    }
}
