package com.transit.hub.domain.model;

import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.testutil.TestDataFactory;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

@DisplayName("Device")
class DeviceTest {

    @Nested
    @DisplayName("recordHeartbeat")
    class RecordHeartbeat {

        @Test
        @DisplayName("sets status to ONLINE")
        void setsStatusToOnline() {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createDevice(stop);

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.OFFLINE);

            device.recordHeartbeat(Instant.parse("2026-05-01T10:00:00Z"));

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        }

        @Test
        @DisplayName("stamps lastHeartbeat with the supplied instant")
        void stampsLastHeartbeatWithSuppliedInstant() {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createDevice(stop);
            Instant now = Instant.parse("2026-05-01T10:00:00Z");

            assertThat(device.getLastHeartbeat()).isNull();

            device.recordHeartbeat(now);

            assertThat(device.getLastHeartbeat()).isEqualTo(now);
        }

        @Test
        @DisplayName("monotonic stamps reflect the supplied instants")
        void repeatedCalls_UpdatesHeartbeat() {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createDevice(stop);
            Instant first = Instant.parse("2026-05-01T10:00:00Z");
            Instant second = first.plusSeconds(5);

            device.recordHeartbeat(first);
            assertThat(device.getLastHeartbeat()).isEqualTo(first);

            device.recordHeartbeat(second);
            assertThat(device.getLastHeartbeat()).isEqualTo(second);
            assertThat(device.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        }
    }

    @Nested
    @DisplayName("markOffline")
    class MarkOffline {

        @Test
        @DisplayName("sets status to OFFLINE")
        void setsStatusToOffline() {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createOnlineDevice(stop);

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.ONLINE);

            device.markOffline();

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        }

        @Test
        @DisplayName("is idempotent when already offline")
        void alreadyOffline_RemainsOffline() {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createDevice(stop);

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.OFFLINE);

            device.markOffline();

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
        }

        @Test
        @DisplayName("does not clear lastHeartbeat")
        void doesNotClearLastHeartbeat() {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createOnlineDevice(stop);
            Instant originalHeartbeat = device.getLastHeartbeat();

            device.markOffline();

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.OFFLINE);
            assertThat(device.getLastHeartbeat()).isEqualTo(originalHeartbeat);
        }
    }
}
