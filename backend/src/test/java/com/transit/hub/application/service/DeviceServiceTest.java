package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.RegisterDeviceRequest;
import com.transit.hub.application.dto.response.DeviceAuthResponse;
import com.transit.hub.application.dto.response.DeviceRegistrationResponse;
import com.transit.hub.application.dto.response.DeviceResponse;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
@DisplayName("DeviceService")
class DeviceServiceTest {

    @Mock
    private DeviceRepository deviceRepository;

    @Mock
    private StopRepository stopRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @InjectMocks
    private DeviceService deviceService;

    private Line testLine;
    private Stop testStop;
    private Device testDevice;
    private UUID testLineId;
    private UUID testStopId;
    private UUID testDeviceId;

    @BeforeEach
    void setUp() {
        testLineId = UUID.randomUUID();
        testStopId = UUID.randomUUID();
        testDeviceId = UUID.randomUUID();
        testLine = TestDataFactory.createLineWithId(testLineId, "L1", "Metro Line 1", "#FF5733");
        testStop = TestDataFactory.createStopWithId(testStopId, "Central Station", testLine);
        testDevice = TestDataFactory.createDeviceWithId(testDeviceId, "hashed_token", testStop, DeviceStatus.OFFLINE);
    }

    @Nested
    @DisplayName("registerDevice")
    class RegisterDevice {

        @Test
        @DisplayName("generates secure token and returns plain token")
        void generatesSecureToken() {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStopId);
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(passwordEncoder.encode(anyString())).thenReturn("hashed_token");
            when(deviceRepository.save(any(Device.class))).thenAnswer(invocation -> {
                Device saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            DeviceRegistrationResponse result = deviceService.registerDevice(request);

            assertThat(result.token()).isNotNull().isNotEmpty();
            // Token should be Base64 URL-safe encoded (32 bytes = 43 chars without padding)
            assertThat(result.token()).hasSize(43);
            assertThat(result.stopId()).isEqualTo(testStopId);
            assertThat(result.stopName()).isEqualTo("Central Station");
        }

        @Test
        @DisplayName("hashes token before storage")
        void hashesTokenBeforeStorage() {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStopId);
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(passwordEncoder.encode(anyString())).thenReturn("hashed_value");
            when(deviceRepository.save(any(Device.class))).thenAnswer(invocation -> {
                Device saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            deviceService.registerDevice(request);

            ArgumentCaptor<Device> captor = ArgumentCaptor.forClass(Device.class);
            verify(deviceRepository).save(captor.capture());
            assertThat(captor.getValue().getTokenHash()).isEqualTo("hashed_value");

            verify(passwordEncoder).encode(anyString());
        }

        @Test
        @DisplayName("creates device with OFFLINE status")
        void createsWithOfflineStatus() {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStopId);
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(passwordEncoder.encode(anyString())).thenReturn("hashed");
            when(deviceRepository.save(any(Device.class))).thenAnswer(invocation -> {
                Device saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            deviceService.registerDevice(request);

            ArgumentCaptor<Device> captor = ArgumentCaptor.forClass(Device.class);
            verify(deviceRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownStopId = UUID.randomUUID();
            RegisterDeviceRequest request = new RegisterDeviceRequest(unknownStopId);
            when(stopRepository.findById(unknownStopId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> deviceService.registerDevice(request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");

            verify(deviceRepository, never()).save(any());
        }

        @Test
        @DisplayName("generates unique tokens for different registrations")
        void generatesUniqueTokens() {
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStopId);
            when(stopRepository.findById(testStopId)).thenReturn(Optional.of(testStop));
            when(passwordEncoder.encode(anyString())).thenReturn("hashed");
            when(deviceRepository.save(any(Device.class))).thenAnswer(invocation -> {
                Device saved = invocation.getArgument(0);
                saved.setId(UUID.randomUUID());
                return saved;
            });

            DeviceRegistrationResponse result1 = deviceService.registerDevice(request);
            DeviceRegistrationResponse result2 = deviceService.registerDevice(request);

            // Tokens should be different
            assertThat(result1.token()).isNotEqualTo(result2.token());
        }
    }

    @Nested
    @DisplayName("authenticateDevice")
    class AuthenticateDevice {

        @Test
        @DisplayName("returns success with valid token")
        void withValidToken_ReturnsSuccess() {
            String plainToken = "valid_token_12345678"; // Must be at least 8 chars
            String tokenLookup = plainToken.substring(0, 8);
            testDevice.setTokenLookup(tokenLookup);
            when(deviceRepository.findByTokenLookup(tokenLookup)).thenReturn(List.of(testDevice));
            when(passwordEncoder.matches(plainToken, "hashed_token")).thenReturn(true);
            when(deviceRepository.save(any(Device.class))).thenReturn(testDevice);

            DeviceAuthResponse result = deviceService.authenticateDevice(plainToken);

            assertThat(result.valid()).isTrue();
            assertThat(result.stopId()).isEqualTo(testStopId);
            assertThat(result.stopName()).isEqualTo("Central Station");
            assertThat(result.lineCode()).isEqualTo("L1");
        }

        @Test
        @DisplayName("records heartbeat on successful authentication")
        void recordsHeartbeatOnSuccess() {
            String plainToken = "valid_token_12345678";
            String tokenLookup = plainToken.substring(0, 8);
            testDevice.setTokenLookup(tokenLookup);
            when(deviceRepository.findByTokenLookup(tokenLookup)).thenReturn(List.of(testDevice));
            when(passwordEncoder.matches(plainToken, "hashed_token")).thenReturn(true);
            when(deviceRepository.save(any(Device.class))).thenReturn(testDevice);

            deviceService.authenticateDevice(plainToken);

            ArgumentCaptor<Device> captor = ArgumentCaptor.forClass(Device.class);
            verify(deviceRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceStatus.ONLINE);
            assertThat(captor.getValue().getLastHeartbeat()).isNotNull();
        }

        @Test
        @DisplayName("returns failure with invalid token")
        void withInvalidToken_ReturnsFailure() {
            String invalidToken = "invalid_token_xyz";
            String tokenLookup = invalidToken.substring(0, 8);
            testDevice.setTokenLookup(tokenLookup);
            when(deviceRepository.findByTokenLookup(tokenLookup)).thenReturn(List.of(testDevice));
            when(passwordEncoder.matches(invalidToken, "hashed_token")).thenReturn(false);

            DeviceAuthResponse result = deviceService.authenticateDevice(invalidToken);

            assertThat(result.valid()).isFalse();
            assertThat(result.stopId()).isNull();
            assertThat(result.stopName()).isNull();
            assertThat(result.lineCode()).isNull();

            verify(deviceRepository, never()).save(any());
        }

        @Test
        @DisplayName("returns failure when no devices exist")
        void withNoDevices_ReturnsFailure() {
            String token = "any_token_12345678";
            String tokenLookup = token.substring(0, 8);
            when(deviceRepository.findByTokenLookup(tokenLookup)).thenReturn(List.of());

            DeviceAuthResponse result = deviceService.authenticateDevice(token);

            assertThat(result.valid()).isFalse();
        }

        @Test
        @DisplayName("returns failure when token is too short")
        void withShortToken_ReturnsFailure() {
            DeviceAuthResponse result = deviceService.authenticateDevice("short");

            assertThat(result.valid()).isFalse();
            verify(deviceRepository, never()).findByTokenLookup(anyString());
        }

        @Test
        @DisplayName("checks devices to find matching token")
        void checksDevices() {
            String plainToken = "valid_for_device2";
            String tokenLookup = plainToken.substring(0, 8);
            Device device1 = TestDataFactory.createDeviceWithLookup(testStop, tokenLookup, "hash1");
            Device device2 = TestDataFactory.createDeviceWithLookup(testStop, tokenLookup, "hash2");
            when(deviceRepository.findByTokenLookup(tokenLookup)).thenReturn(List.of(device1, device2));
            // Use lenient stubbing since the implementation short-circuits on first match
            lenient().when(passwordEncoder.matches(plainToken, "hash1")).thenReturn(false);
            lenient().when(passwordEncoder.matches(plainToken, "hash2")).thenReturn(true);
            when(deviceRepository.save(any(Device.class))).thenReturn(device2);

            DeviceAuthResponse result = deviceService.authenticateDevice(plainToken);

            assertThat(result.valid()).isTrue();
            // Verifies that passwordEncoder.matches was called (at least once for the matching device)
            verify(passwordEncoder, atLeastOnce()).matches(anyString(), anyString());
        }
    }

    @Nested
    @DisplayName("recordHeartbeat")
    class RecordHeartbeat {

        @Test
        @DisplayName("sets status to ONLINE and updates lastHeartbeat")
        void setsStatusToOnline() {
            when(deviceRepository.findById(testDeviceId)).thenReturn(Optional.of(testDevice));
            when(deviceRepository.save(any(Device.class))).thenReturn(testDevice);

            deviceService.recordHeartbeat(testDeviceId);

            ArgumentCaptor<Device> captor = ArgumentCaptor.forClass(Device.class);
            verify(deviceRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceStatus.ONLINE);
            assertThat(captor.getValue().getLastHeartbeat()).isNotNull();
        }

        @Test
        @DisplayName("throws EntityNotFoundException when device not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(deviceRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> deviceService.recordHeartbeat(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Device");
        }
    }

    @Nested
    @DisplayName("checkOfflineDevices")
    class CheckOfflineDevices {

        @Test
        @DisplayName("marks stale online devices as offline")
        void marksStaleAsOffline() {
            Device staleDevice = TestDataFactory.createOnlineDevice(testStop);
            staleDevice.setLastHeartbeat(Instant.now().minus(Duration.ofMinutes(5)));
            when(deviceRepository.findStaleOnlineDevices(any(Instant.class))).thenReturn(List.of(staleDevice));

            deviceService.checkOfflineDevices();

            ArgumentCaptor<Device> captor = ArgumentCaptor.forClass(Device.class);
            verify(deviceRepository).save(captor.capture());
            assertThat(captor.getValue().getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        }

        @Test
        @DisplayName("does nothing when no stale devices")
        void doesNothingWhenNoStaleDevices() {
            when(deviceRepository.findStaleOnlineDevices(any(Instant.class))).thenReturn(List.of());

            deviceService.checkOfflineDevices();

            verify(deviceRepository, never()).save(any());
        }

        @Test
        @DisplayName("marks multiple stale devices as offline")
        void marksMultipleDevicesOffline() {
            Device stale1 = TestDataFactory.createOnlineDevice(testStop);
            Device stale2 = TestDataFactory.createOnlineDevice(testStop);
            when(deviceRepository.findStaleOnlineDevices(any(Instant.class))).thenReturn(List.of(stale1, stale2));

            deviceService.checkOfflineDevices();

            verify(deviceRepository, times(2)).save(any(Device.class));
        }
    }

    @Nested
    @DisplayName("getAllDevices")
    class GetAllDevices {

        @Test
        @DisplayName("returns all devices")
        void returnsAllDevices() {
            Device device1 = TestDataFactory.createDevice(testStop);
            Device device2 = TestDataFactory.createOnlineDevice(testStop);
            when(deviceRepository.findAllWithStopAndLine()).thenReturn(List.of(device1, device2));

            List<DeviceResponse> result = deviceService.getAllDevices();

            assertThat(result).hasSize(2);
        }

        @Test
        @DisplayName("returns empty list when no devices")
        void returnsEmptyWhenNoDevices() {
            when(deviceRepository.findAllWithStopAndLine()).thenReturn(List.of());

            List<DeviceResponse> result = deviceService.getAllDevices();

            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("getDevicesByStatus")
    class GetDevicesByStatus {

        @Test
        @DisplayName("returns only online devices when filtering by ONLINE")
        void returnsOnlineDevices() {
            Device onlineDevice = TestDataFactory.createOnlineDevice(testStop);
            when(deviceRepository.findByStatus(DeviceStatus.ONLINE)).thenReturn(List.of(onlineDevice));

            List<DeviceResponse> result = deviceService.getDevicesByStatus(DeviceStatus.ONLINE);

            assertThat(result).hasSize(1);
        }

        @Test
        @DisplayName("returns only offline devices when filtering by OFFLINE")
        void returnsOfflineDevices() {
            Device offlineDevice = TestDataFactory.createDevice(testStop);
            when(deviceRepository.findByStatus(DeviceStatus.OFFLINE)).thenReturn(List.of(offlineDevice));

            List<DeviceResponse> result = deviceService.getDevicesByStatus(DeviceStatus.OFFLINE);

            assertThat(result).hasSize(1);
        }
    }

    @Nested
    @DisplayName("getDevice")
    class GetDevice {

        @Test
        @DisplayName("returns device when found")
        void returnsDeviceWhenFound() {
            when(deviceRepository.findById(testDeviceId)).thenReturn(Optional.of(testDevice));

            DeviceResponse result = deviceService.getDevice(testDeviceId);

            assertThat(result.id()).isEqualTo(testDeviceId);
            assertThat(result.stopId()).isEqualTo(testStopId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(deviceRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> deviceService.getDevice(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Device");
        }
    }

    @Nested
    @DisplayName("updateDevice")
    class UpdateDevice {

        @Test
        @DisplayName("updates device stop")
        void updatesDeviceStop() {
            UUID newStopId = UUID.randomUUID();
            Stop newStop = TestDataFactory.createStopWithId(newStopId, "New Station", testLine);
            RegisterDeviceRequest request = new RegisterDeviceRequest(newStopId);
            when(deviceRepository.findById(testDeviceId)).thenReturn(Optional.of(testDevice));
            when(stopRepository.findById(newStopId)).thenReturn(Optional.of(newStop));
            when(deviceRepository.save(any(Device.class))).thenAnswer(invocation -> invocation.getArgument(0));

            DeviceResponse result = deviceService.updateDevice(testDeviceId, request);

            ArgumentCaptor<Device> captor = ArgumentCaptor.forClass(Device.class);
            verify(deviceRepository).save(captor.capture());
            assertThat(captor.getValue().getStop()).isEqualTo(newStop);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when device not found")
        void throwsWhenDeviceNotFound() {
            UUID unknownId = UUID.randomUUID();
            RegisterDeviceRequest request = new RegisterDeviceRequest(testStopId);
            when(deviceRepository.findById(unknownId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> deviceService.updateDevice(unknownId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Device");
        }

        @Test
        @DisplayName("throws EntityNotFoundException when new stop not found")
        void throwsWhenStopNotFound() {
            UUID unknownStopId = UUID.randomUUID();
            RegisterDeviceRequest request = new RegisterDeviceRequest(unknownStopId);
            when(deviceRepository.findById(testDeviceId)).thenReturn(Optional.of(testDevice));
            when(stopRepository.findById(unknownStopId)).thenReturn(Optional.empty());

            assertThatThrownBy(() -> deviceService.updateDevice(testDeviceId, request))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Stop");
        }
    }

    @Nested
    @DisplayName("authenticateDevice - edge cases")
    class AuthenticateDeviceEdgeCases {

        @Test
        @DisplayName("returns failure with null token")
        void withNullToken_ReturnsFailure() {
            DeviceAuthResponse result = deviceService.authenticateDevice(null);

            assertThat(result.valid()).isFalse();
            assertThat(result.stopId()).isNull();
            assertThat(result.stopName()).isNull();
            assertThat(result.lineCode()).isNull();
            verify(deviceRepository, never()).findByTokenLookup(anyString());
        }

        @Test
        @DisplayName("returns failure with empty string token")
        void withEmptyToken_ReturnsFailure() {
            DeviceAuthResponse result = deviceService.authenticateDevice("");

            assertThat(result.valid()).isFalse();
            assertThat(result.stopId()).isNull();
            verify(deviceRepository, never()).findByTokenLookup(anyString());
        }

        @Test
        @DisplayName("returns failure with token shorter than 8 chars")
        void withSevenCharToken_ReturnsFailure() {
            DeviceAuthResponse result = deviceService.authenticateDevice("1234567");

            assertThat(result.valid()).isFalse();
            verify(deviceRepository, never()).findByTokenLookup(anyString());
        }

        @Test
        @DisplayName("proceeds to lookup with token of exactly 8 chars")
        void withExactlyEightCharToken_ProceedsToLookup() {
            String token = "12345678";
            when(deviceRepository.findByTokenLookup("12345678")).thenReturn(List.of());

            DeviceAuthResponse result = deviceService.authenticateDevice(token);

            assertThat(result.valid()).isFalse();
            verify(deviceRepository).findByTokenLookup("12345678");
        }
    }

    @Nested
    @DisplayName("checkOfflineDevices - threshold boundary")
    class CheckOfflineDevicesThreshold {

        @Test
        @DisplayName("query uses threshold based on 2-minute heartbeat timeout")
        void usesCorrectThreshold() {
            when(deviceRepository.findStaleOnlineDevices(any(Instant.class))).thenReturn(List.of());

            Instant before = Instant.now().minus(Duration.ofMinutes(2));
            deviceService.checkOfflineDevices();
            Instant after = Instant.now().minus(Duration.ofMinutes(2));

            ArgumentCaptor<Instant> captor = ArgumentCaptor.forClass(Instant.class);
            verify(deviceRepository).findStaleOnlineDevices(captor.capture());
            Instant threshold = captor.getValue();
            assertThat(threshold).isBetween(before, after);
        }
    }

    @Nested
    @DisplayName("Device status transitions")
    class DeviceStatusTransitions {

        @Test
        @DisplayName("supports OFFLINE to ONLINE to OFFLINE sequence")
        void offlineToOnlineToOfflineSequence() {
            // Start OFFLINE
            assertThat(testDevice.getStatus()).isEqualTo(DeviceStatus.OFFLINE);

            // Transition to ONLINE via heartbeat
            when(deviceRepository.findById(testDeviceId)).thenReturn(Optional.of(testDevice));
            when(deviceRepository.save(any(Device.class))).thenReturn(testDevice);

            deviceService.recordHeartbeat(testDeviceId);

            assertThat(testDevice.getStatus()).isEqualTo(DeviceStatus.ONLINE);
            assertThat(testDevice.getLastHeartbeat()).isNotNull();

            // Transition back to OFFLINE via checkOfflineDevices
            testDevice.setLastHeartbeat(Instant.now().minus(Duration.ofMinutes(5)));
            when(deviceRepository.findStaleOnlineDevices(any(Instant.class))).thenReturn(List.of(testDevice));

            deviceService.checkOfflineDevices();

            assertThat(testDevice.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        }
    }

    @Nested
    @DisplayName("deleteDevice")
    class DeleteDevice {

        @Test
        @DisplayName("deletes existing device")
        void deletesExistingDevice() {
            when(deviceRepository.existsById(testDeviceId)).thenReturn(true);

            deviceService.deleteDevice(testDeviceId);

            verify(deviceRepository).deleteById(testDeviceId);
        }

        @Test
        @DisplayName("throws EntityNotFoundException when device not found")
        void throwsWhenNotFound() {
            UUID unknownId = UUID.randomUUID();
            when(deviceRepository.existsById(unknownId)).thenReturn(false);

            assertThatThrownBy(() -> deviceService.deleteDevice(unknownId))
                    .isInstanceOf(EntityNotFoundException.class)
                    .hasMessageContaining("Device");

            verify(deviceRepository, never()).deleteById(any());
        }
    }
}
