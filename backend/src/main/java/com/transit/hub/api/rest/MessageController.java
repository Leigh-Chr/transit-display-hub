package com.transit.hub.api.rest;

import com.transit.hub.application.dto.request.CreateMessageRequest;
import com.transit.hub.application.dto.response.MessageResponse;
import com.transit.hub.application.service.MessageService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/messages")
@RequiredArgsConstructor
public class MessageController {

    private final MessageService messageService;

    @GetMapping
    public ResponseEntity<List<MessageResponse>> getMessages(
            @RequestParam(required = false, defaultValue = "false") boolean active
    ) {
        if (active) {
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
