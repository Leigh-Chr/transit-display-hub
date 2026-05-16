package com.transit.hub.infrastructure.websocket;

import com.transit.hub.application.service.HeartbeatBuffer;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.handler.annotation.Payload;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Controller;

import java.util.Map;
import java.util.UUID;

@Controller
@RequiredArgsConstructor
@Slf4j
public class DeviceHeartbeatController {

    private final HeartbeatBuffer heartbeatBuffer;

    @MessageMapping("/device/heartbeat")
    public void handleHeartbeat(@Payload HeartbeatMessage message, SimpMessageHeaderAccessor accessor) {
        if (message == null || message.deviceId() == null) {
            return;
        }
        if (!matchesBoundDevice(accessor, message.deviceId())) {
            log.warn("Heartbeat payload deviceId {} does not match session-bound deviceId; dropping",
                    message.deviceId());
            return;
        }
        // Buffered write — the in-memory map absorbs the WS hot path and a
        // scheduled flush coalesces the per-device updates into a single
        // batched UPDATE. Unknown devices are silently dropped at flush
        // time so a stale token in a kiosk loop doesn't spam the log
        // every 30 s.
        heartbeatBuffer.record(message.deviceId());
    }

    /**
     * When the CONNECT frame carried a valid {@code device-token} header,
     * {@code WebSocketConfig} stored the resolved deviceId in the STOMP
     * session attributes. Heartbeats whose payload deviceId doesn't match
     * the bound one are dropped.
     *
     * <p>When no deviceId is bound (anonymous CONNECT without device-token)
     * the controller falls back to the legacy behaviour: accept any deviceId.
     * Clients can opt into the stricter check by sending the device-token
     * header at CONNECT time.
     */
    private boolean matchesBoundDevice(SimpMessageHeaderAccessor accessor, UUID payloadDeviceId) {
        Map<String, Object> attrs = accessor.getSessionAttributes();
        if (attrs == null) {
            return true;
        }
        Object bound = attrs.get(WebSocketConfig.DEVICE_ID_SESSION_KEY);
        if (bound == null) {
            return true;
        }
        return payloadDeviceId.equals(bound);
    }

    public record HeartbeatMessage(UUID deviceId) {}
}
