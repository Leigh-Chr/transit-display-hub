package com.transit.hub.application.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

@ExtendWith(MockitoExtension.class)
class HeartbeatBufferTest {

    @Mock private DeviceService deviceService;

    private HeartbeatBuffer buffer;
    private final Clock clock = Clock.fixed(Instant.parse("2026-05-16T09:00:00Z"), ZoneId.of("UTC"));

    @BeforeEach
    void setUp() {
        buffer = new HeartbeatBuffer(deviceService, clock);
    }

    @Test
    void recordDoesNotHitTheDatabase() {
        buffer.record(UUID.randomUUID());

        verifyNoInteractions(deviceService);
    }

    @Test
    void flushDelegatesPendingHeartbeatsToTheBatchEndpoint() {
        UUID a = UUID.randomUUID();
        UUID b = UUID.randomUUID();

        buffer.record(a);
        buffer.record(b);
        buffer.flush();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<UUID, Instant>> captor = ArgumentCaptor.forClass(Map.class);
        verify(deviceService).recordHeartbeatsBatch(captor.capture());
        assertThat(captor.getValue()).containsOnlyKeys(a, b);
        assertThat(captor.getValue().get(a)).isEqualTo(Instant.parse("2026-05-16T09:00:00Z"));
    }

    @Test
    void duplicateRecordKeepsTheLatestTimestamp() {
        UUID id = UUID.randomUUID();
        Clock advancing = new Clock() {
            private int call = 0;
            @Override public ZoneId getZone() { return ZoneId.of("UTC"); }
            @Override public Clock withZone(ZoneId zone) { return this; }
            @Override public Instant instant() {
                Instant t = Instant.parse("2026-05-16T09:00:00Z").plusSeconds(call * 5L);
                call++;
                return t;
            }
        };
        HeartbeatBuffer freshBuffer = new HeartbeatBuffer(deviceService, advancing);

        freshBuffer.record(id);
        freshBuffer.record(id);
        freshBuffer.flush();

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<UUID, Instant>> captor = ArgumentCaptor.forClass(Map.class);
        verify(deviceService).recordHeartbeatsBatch(captor.capture());
        // Map.put semantics: the second record() overwrites the first, so we
        // see the latest timestamp (call=1 → +5s) — which is also what the
        // batched UPDATE should persist.
        assertThat(captor.getValue().get(id)).isEqualTo(Instant.parse("2026-05-16T09:00:05Z"));
    }

    @Test
    void flushIsNoopWhenNothingPending() {
        buffer.flush();

        verify(deviceService, never()).recordHeartbeatsBatch(org.mockito.ArgumentMatchers.anyMap());
    }

    @Test
    void scheduledFlushDrainsThePendingMap() {
        UUID id = UUID.randomUUID();
        buffer.record(id);

        buffer.scheduledFlush();
        // A second scheduledFlush right after the first must see an empty
        // map — otherwise the same heartbeat would persist twice (no harm
        // functionally, but defeats the batching contract).
        buffer.scheduledFlush();

        verify(deviceService).recordHeartbeatsBatch(org.mockito.ArgumentMatchers.anyMap());
    }
}
