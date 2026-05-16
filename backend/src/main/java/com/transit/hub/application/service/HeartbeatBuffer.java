package com.transit.hub.application.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Coalesces device heartbeats arriving over WebSocket into a single
 * batched UPDATE every 30 seconds. The WS hot path then writes
 * O(1) to an in-memory map instead of triggering a SELECT + UPDATE
 * round-trip per kiosk, so a 50-device fleet that wakes up at the same
 * time stops producing 50 simultaneous transactions on the Hikari pool.
 *
 * <p>The trade-off is that {@link com.transit.hub.domain.model.Device#getLastHeartbeat()}
 * lags by up to 30 s; this is the same window
 * {@link DeviceService#checkOfflineDevices()} already uses to decide
 * stale-ness, so the user-facing semantics are unchanged.
 *
 * <p>Falls back to {@link DeviceService#recordHeartbeat(UUID)} for the
 * synchronous code paths (admin manual probe, integration tests that
 * assert immediately) so the existing contract stays intact.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class HeartbeatBuffer {

    private final DeviceService deviceService;
    private final Clock clock;

    private final ConcurrentMap<UUID, Instant> pending = new ConcurrentHashMap<>();

    /**
     * Records a heartbeat without touching the database. The next flush
     * tick will batch every queued device into a single UPDATE. Returns
     * the timestamp recorded so callers that audit can correlate.
     */
    public Instant record(UUID deviceId) {
        Instant now = Instant.now(clock);
        pending.put(deviceId, now);
        return now;
    }

    /**
     * Drains the pending map and applies the heartbeats in one round-
     * trip. Public so tests (and the eventual admin "flush now" endpoint)
     * can force a synchronous flush rather than wait for the scheduler.
     */
    public void flush() {
        if (pending.isEmpty()) {
            return;
        }
        // Atomic drain — any heartbeat that arrives between snapshot
        // and clear lands in the next batch. We snapshot before
        // calling out to the DB to keep the WS thread non-blocking.
        Map<UUID, Instant> snapshot = new HashMap<>();
        pending.keySet().forEach(id -> {
            Instant value = pending.remove(id);
            if (value != null) {
                snapshot.put(id, value);
            }
        });
        if (snapshot.isEmpty()) {
            return;
        }
        deviceService.recordHeartbeatsBatch(snapshot);
        log.debug("Flushed {} pending heartbeats", snapshot.size());
    }

    /**
     * Scheduled at the same cadence as {@link DeviceService#checkOfflineDevices()}
     * so the offline-detection sweep always sees a freshly flushed view
     * of the heartbeats and never falsely marks a healthy device as
     * stale because of buffer lag.
     */
    @Scheduled(fixedRate = 30_000)
    public void scheduledFlush() {
        flush();
    }
}
