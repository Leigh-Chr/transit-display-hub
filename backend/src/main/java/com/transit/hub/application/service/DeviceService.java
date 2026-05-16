package com.transit.hub.application.service;

import com.transit.hub.application.dto.request.RegisterDeviceRequest;
import com.transit.hub.application.dto.response.DeviceAuthResponse;
import com.transit.hub.application.dto.response.DeviceRegistrationResponse;
import com.transit.hub.application.dto.response.DeviceResponse;
import com.transit.hub.application.dto.response.LineInfo;
import com.transit.hub.application.exception.EntityNotFoundException;
import com.transit.hub.application.support.UnpaginatedCap;
import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.infrastructure.persistence.DeviceRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DeviceService {

    private final DeviceRepository deviceRepository;
    private final StopRepository stopRepository;
    private final PasswordEncoder passwordEncoder;
    private final Clock clock;

    private static final SecureRandom SECURE_RANDOM = new SecureRandom();
    private static final Duration HEARTBEAT_TIMEOUT = Duration.ofMinutes(2);

    @Transactional(readOnly = true)
    public List<DeviceResponse> getAllDevices() {
        // Defensive cap (audit P1 B-7): page over ids first, then hydrate
        // only the bounded page with stop + lines so a future deployment
        // with thousands of kiosks does not pin a Hikari thread on a
        // multi-megabyte JSON serialisation. The cap warns operators when
        // the unpaginated read path needs to migrate to true paging.
        Page<UUID> idsPage = deviceRepository.findAllIds(
                PageRequest.of(0, UnpaginatedCap.MAX_ROWS));
        if (idsPage.hasNext()) {
            log.warn("getAllDevices() capped at {} rows (totalElements={}); switch to a paginated endpoint",
                    UnpaginatedCap.MAX_ROWS, idsPage.getTotalElements());
        }
        if (idsPage.getContent().isEmpty()) {
            return List.of();
        }
        return deviceRepository.findAllByIdInWithStopAndLine(idsPage.getContent()).stream()
                .map(DeviceResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<DeviceResponse> getDevicesByStatus(DeviceStatus status) {
        return deviceRepository.findByStatus(status).stream()
                .map(DeviceResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public DeviceResponse getDevice(UUID id) {
        return deviceRepository.findById(id)
                .map(DeviceResponse::from)
                .orElseThrow(() -> new EntityNotFoundException("Device", id));
    }

    private static final int TOKEN_LOOKUP_LENGTH = 8;

    @Transactional
    public DeviceRegistrationResponse registerDevice(RegisterDeviceRequest request) {
        Stop stop = stopRepository.findById(request.stopId())
                .orElseThrow(() -> new EntityNotFoundException("Stop", request.stopId()));

        // Generate a secure token
        String plainToken = generateSecureToken();
        String tokenLookup = plainToken.substring(0, TOKEN_LOOKUP_LENGTH);
        String tokenHash = passwordEncoder.encode(plainToken);

        Device device = Device.builder()
                .tokenLookup(tokenLookup)
                .tokenHash(tokenHash)
                .stop(stop)
                .status(DeviceStatus.OFFLINE)
                .build();

        Device saved = deviceRepository.save(device);

        return new DeviceRegistrationResponse(
                saved.getId(),
                plainToken, // Return plain token ONCE
                stop.getId(),
                stop.getName()
        );
    }

    @Transactional
    public DeviceResponse updateDevice(UUID id, RegisterDeviceRequest request) {
        Device device = deviceRepository.findById(id)
                .orElseThrow(() -> new EntityNotFoundException("Device", id));

        Stop stop = stopRepository.findById(request.stopId())
                .orElseThrow(() -> new EntityNotFoundException("Stop", request.stopId()));

        device.setStop(stop);
        Device saved = deviceRepository.save(device);
        return DeviceResponse.from(saved);
    }

    @Transactional
    public void deleteDevice(UUID id) {
        if (!deviceRepository.existsById(id)) {
            throw new EntityNotFoundException("Device", id);
        }
        deviceRepository.deleteById(id);
    }

    @Transactional
    public DeviceAuthResponse authenticateDevice(String token) {
        if (token == null || token.length() < TOKEN_LOOKUP_LENGTH) {
            return new DeviceAuthResponse(false, null, null, null, null);
        }

        // Use token prefix for fast lookup, then verify with BCrypt
        String tokenLookup = token.substring(0, TOKEN_LOOKUP_LENGTH);
        List<Device> candidates = deviceRepository.findByTokenLookup(tokenLookup);

        for (Device device : candidates) {
            if (passwordEncoder.matches(token, device.getTokenHash())) {
                device.recordHeartbeat(Instant.now(clock));
                deviceRepository.save(device);

                List<LineInfo> lines = device.getStop().getLines().stream()
                        .sorted(java.util.Comparator.comparing(Line::getCode))
                        .map(LineInfo::from)
                        .toList();

                return new DeviceAuthResponse(
                        true,
                        device.getId(),
                        device.getStop().getId(),
                        device.getStop().getName(),
                        lines
                );
            }
        }

        return new DeviceAuthResponse(false, null, null, null, null);
    }

    @Transactional
    public void recordHeartbeat(UUID deviceId) {
        Device device = deviceRepository.findById(deviceId)
                .orElseThrow(() -> new EntityNotFoundException("Device", deviceId));

        device.recordHeartbeat(Instant.now(clock));
        deviceRepository.save(device);
    }

    /**
     * Bulk-apply a (deviceId → lastSeen) snapshot collected by
     * {@link HeartbeatBuffer}. Single SELECT … IN (…) followed by one
     * batched UPDATE, instead of one round-trip per heartbeat. Unknown
     * ids are silently dropped — kiosks reconnecting on a stale token
     * may emit a few heartbeats for a device row the operator just
     * deleted, and we don't want to spam the log every 30 s for that.
     */
    @Transactional
    public void recordHeartbeatsBatch(java.util.Map<UUID, Instant> heartbeatsByDeviceId) {
        if (heartbeatsByDeviceId.isEmpty()) {
            return;
        }
        List<Device> devices = deviceRepository.findAllById(heartbeatsByDeviceId.keySet());
        for (Device device : devices) {
            Instant ts = heartbeatsByDeviceId.get(device.getId());
            if (ts != null) {
                device.recordHeartbeat(ts);
            }
        }
        deviceRepository.saveAll(devices);
    }

    @Scheduled(fixedRate = 30000) // Every 30 seconds
    @Transactional
    public void checkOfflineDevices() {
        Instant threshold = Instant.now(clock).minus(HEARTBEAT_TIMEOUT);
        List<Device> staleDevices = deviceRepository.findStaleOnlineDevices(threshold);

        for (Device device : staleDevices) {
            device.markOffline();
            deviceRepository.save(device);
        }
    }

    private String generateSecureToken() {
        byte[] tokenBytes = new byte[32]; // 256 bits
        SECURE_RANDOM.nextBytes(tokenBytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(tokenBytes);
    }
}
