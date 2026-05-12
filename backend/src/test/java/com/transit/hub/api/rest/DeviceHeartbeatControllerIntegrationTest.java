package com.transit.hub.api.rest;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.websocket.DeviceHeartbeatController;
import com.transit.hub.infrastructure.websocket.DeviceHeartbeatController.HeartbeatMessage;
import com.transit.hub.infrastructure.websocket.WebSocketConfig;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.simp.SimpMessageType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Field;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Exercises the STOMP-bound heartbeat controller end-to-end against a
 * real Spring context. The {@code @MessageMapping} method is invoked
 * directly with a constructed {@link SimpMessageHeaderAccessor} so we
 * cover both the session-bound and anonymous branches without spinning
 * up a STOMP broker.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@DisplayName("DeviceHeartbeatController Integration Tests")
class DeviceHeartbeatControllerIntegrationTest {

    @Autowired private DeviceHeartbeatController controller;
    @Autowired private DeviceRepository deviceRepository;
    @Autowired private StopRepository stopRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private PasswordEncoder passwordEncoder;

    private Device testDevice;

    @BeforeEach
    void setUp() {
        deviceRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();

        Line line = Line.builder().code("L1").name("Metro Line 1").color("#FF5733").build();
        lineRepository.save(line);

        Stop stop = Stop.builder()
                .name("Central Station")
                .lines(new java.util.HashSet<>(java.util.Set.of(line)))
                .build();
        stopRepository.save(stop);

        String plainToken = "heartbeat-token-1234567890";
        testDevice = Device.builder()
                .tokenLookup(plainToken.substring(0, 8))
                .tokenHash(passwordEncoder.encode(plainToken))
                .stop(stop)
                .status(DeviceStatus.OFFLINE)
                .build();
        deviceRepository.save(testDevice);
    }

    private SimpMessageHeaderAccessor anonymousAccessor() {
        return SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
    }

    private SimpMessageHeaderAccessor accessorBoundTo(UUID boundDeviceId) {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create(SimpMessageType.MESSAGE);
        Map<String, Object> attrs = new HashMap<>();
        attrs.put(deviceIdSessionKey(), boundDeviceId);
        accessor.setSessionAttributes(attrs);
        return accessor;
    }

    /** {@link WebSocketConfig#DEVICE_ID_SESSION_KEY} is package-private; read it
     *  reflectively so the test isn't coupled to its literal value. */
    private static String deviceIdSessionKey() {
        try {
            Field field = WebSocketConfig.class.getDeclaredField("DEVICE_ID_SESSION_KEY");
            field.setAccessible(true);
            return (String) field.get(null);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
    }

    @Nested
    @DisplayName("handleHeartbeat()")
    class HandleHeartbeat {

        @Test
        @DisplayName("anonymous CONNECT — heartbeat for a known device is recorded")
        void anonymousSession_ValidDevice_RecordsHeartbeat() {
            assertThat(testDevice.getLastHeartbeat()).isNull();
            assertThat(testDevice.getStatus()).isEqualTo(DeviceStatus.OFFLINE);

            Instant before = Instant.now().minusSeconds(1);
            controller.handleHeartbeat(new HeartbeatMessage(testDevice.getId()), anonymousAccessor());

            Device reloaded = deviceRepository.findById(testDevice.getId()).orElseThrow();
            assertThat(reloaded.getLastHeartbeat()).isNotNull();
            assertThat(reloaded.getLastHeartbeat()).isAfter(before);
            assertThat(reloaded.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        }

        @Test
        @DisplayName("device-token bound CONNECT — payload matching the bound device records heartbeat")
        void boundSession_MatchingDevice_RecordsHeartbeat() {
            controller.handleHeartbeat(
                    new HeartbeatMessage(testDevice.getId()),
                    accessorBoundTo(testDevice.getId()));

            Device reloaded = deviceRepository.findById(testDevice.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(DeviceStatus.ONLINE);
            assertThat(reloaded.getLastHeartbeat()).isNotNull();
        }

        @Test
        @DisplayName("device-token bound CONNECT — payload mismatching the bound device is dropped")
        void boundSession_MismatchedDevice_DoesNotRecord() {
            UUID otherDeviceId = UUID.randomUUID();
            controller.handleHeartbeat(
                    new HeartbeatMessage(otherDeviceId),
                    accessorBoundTo(testDevice.getId()));

            Device reloaded = deviceRepository.findById(testDevice.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
            assertThat(reloaded.getLastHeartbeat()).isNull();
        }

        @Test
        @DisplayName("heartbeat for an unknown device id is silently ignored")
        void unknownDeviceId_DoesNotThrow() {
            UUID unknownDeviceId = UUID.randomUUID();
            // No exception should bubble up — controller catches EntityNotFoundException
            controller.handleHeartbeat(new HeartbeatMessage(unknownDeviceId), anonymousAccessor());

            Device reloaded = deviceRepository.findById(testDevice.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        }

        @Test
        @DisplayName("null payload is ignored without side effects")
        void nullPayload_NoOp() {
            controller.handleHeartbeat(null, anonymousAccessor());

            Device reloaded = deviceRepository.findById(testDevice.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
            assertThat(reloaded.getLastHeartbeat()).isNull();
        }

        @Test
        @DisplayName("payload with null deviceId is ignored without side effects")
        void payloadWithNullDeviceId_NoOp() {
            controller.handleHeartbeat(new HeartbeatMessage(null), anonymousAccessor());

            Device reloaded = deviceRepository.findById(testDevice.getId()).orElseThrow();
            assertThat(reloaded.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
            assertThat(reloaded.getLastHeartbeat()).isNull();
        }
    }
}
