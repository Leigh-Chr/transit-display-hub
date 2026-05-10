package com.transit.hub.infrastructure.websocket;

import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.service.DeviceService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.stereotype.Controller;

import java.util.UUID;

@Controller
@RequiredArgsConstructor
@Slf4j
public class DeviceHeartbeatController {

    private final DeviceService deviceService;

    @MessageMapping("/device/heartbeat")
    public void handleHeartbeat(@Payload HeartbeatMessage message) {
        if (message == null || message.deviceId() == null) {
            return;
        }
        try {
            deviceService.recordHeartbeat(message.deviceId());
        } catch (EntityNotFoundException e) {
            log.debug("Heartbeat received for unknown device {}", message.deviceId());
        }
    }

    public record HeartbeatMessage(UUID deviceId) {}
}
