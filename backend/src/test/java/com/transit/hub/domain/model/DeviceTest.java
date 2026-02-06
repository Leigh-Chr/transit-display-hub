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

            device.recordHeartbeat();

            assertThat(device.getStatus()).isEqualTo(DeviceStatus.ONLINE);
        }

        @Test
        @DisplayName("updates lastHeartbeat to current time")
        void updatesLastHeartbeat() {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createDevice(stop);

            assertThat(device.getLastHeartbeat()).isNull();

            Instant before = Instant.now();
            device.recordHeartbeat();
            Instant after = Instant.now();

            assertThat(device.getLastHeartbeat()).isNotNull();
            assertThat(device.getLastHeartbeat()).isAfterOrEqualTo(before);
            assertThat(device.getLastHeartbeat()).isBeforeOrEqualTo(after);
        }

        @Test
        @DisplayName("updates lastHeartbeat on repeated calls")
        void repeatedCalls_UpdatesHeartbeat() throws InterruptedException {
            Line line = TestDataFactory.createLine();
            Stop stop = TestDataFactory.createStop(line);
            Device device = TestDataFactory.createDevice(stop);

            device.recordHeartbeat();
            Instant firstHeartbeat = device.getLastHeartbeat();

            // Small delay to ensure different timestamp
            Thread.sleep(5);

            device.recordHeartbeat();
            Instant secondHeartbeat = device.getLastHeartbeat();

            assertThat(secondHeartbeat).isAfterOrEqualTo(firstHeartbeat);
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
