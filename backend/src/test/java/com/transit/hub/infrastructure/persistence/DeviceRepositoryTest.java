package com.transit.hub.infrastructure.persistence;

import com.transit.hub.domain.model.Device;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.DeviceStatus;
import com.transit.hub.domain.model.enums.LineType;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.ImportAutoConfiguration;
import org.springframework.boot.cache.autoconfigure.CacheAutoConfiguration;
import org.springframework.boot.data.jpa.test.autoconfigure.DataJpaTest;
import org.springframework.boot.jpa.test.autoconfigure.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

@DataJpaTest
@ImportAutoConfiguration(CacheAutoConfiguration.class)
@ActiveProfiles("test")
@DisplayName("DeviceRepository")
class DeviceRepositoryTest {

    @Autowired
    private DeviceRepository repository;

    @Autowired
    private TestEntityManager em;

    private Line line1;
    private Line line2;
    private Stop stop1;
    private Stop stop2;
    private Stop stop3;

    @BeforeEach
    void setUp() {
        line1 = Line.builder()
                .code("M1")
                .name("Metro Line 1")
                .color("#FF0000")
                .type(LineType.METRO)
                .build();
        em.persist(line1);

        line2 = Line.builder()
                .code("B2")
                .name("Bus Line 2")
                .color("#00FF00")
                .type(LineType.BUS)
                .build();
        em.persist(line2);

        stop1 = Stop.builder().name("Central Station").build();
        stop1.addLine(line1);
        stop1.addLine(line2);
        em.persist(stop1);

        stop2 = Stop.builder().name("North Station").build();
        stop2.addLine(line1);
        em.persist(stop2);

        stop3 = Stop.builder().name("South Station").build();
        stop3.addLine(line2);
        em.persist(stop3);

        em.flush();
        em.clear();
    }

    private Device persistDevice(Stop stop, DeviceStatus status, Instant lastHeartbeat,
                                 String tokenLookup, String tokenHash) {
        Device device = Device.builder()
                .stop(stop)
                .status(status)
                .lastHeartbeat(lastHeartbeat)
                .tokenLookup(tokenLookup)
                .tokenHash(tokenHash)
                .build();
        em.persist(device);
        return device;
    }

    @Nested
    @DisplayName("findStaleOnlineDevices")
    class FindStaleOnlineDevices {

        @Test
        @DisplayName("returns ONLINE devices with lastHeartbeat before the threshold")
        void returnsStaleOnlineDevices() {
            Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);

            // Stale ONLINE: heartbeat 10 minutes ago
            persistDevice(stop1, DeviceStatus.ONLINE,
                    Instant.now().minus(10, ChronoUnit.MINUTES),
                    "stale001", "hash_stale_1");
            // Fresh ONLINE: heartbeat 1 minute ago
            persistDevice(stop2, DeviceStatus.ONLINE,
                    Instant.now().minus(1, ChronoUnit.MINUTES),
                    "fresh001", "hash_fresh_1");
            em.flush();
            em.clear();

            List<Device> result = repository.findStaleOnlineDevices(threshold);

            assertThat(result).hasSize(1);
            assertThat(result.getFirst().getTokenLookup()).isEqualTo("stale001");
        }

        @Test
        @DisplayName("excludes OFFLINE devices even if heartbeat is stale")
        void excludesOfflineDevices() {
            Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);

            // OFFLINE with stale heartbeat
            persistDevice(stop1, DeviceStatus.OFFLINE,
                    Instant.now().minus(10, ChronoUnit.MINUTES),
                    "off00001", "hash_offline_1");
            em.flush();
            em.clear();

            List<Device> result = repository.findStaleOnlineDevices(threshold);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("excludes ONLINE devices with heartbeat after the threshold")
        void excludesFreshOnlineDevices() {
            Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);

            persistDevice(stop1, DeviceStatus.ONLINE,
                    Instant.now().minus(2, ChronoUnit.MINUTES),
                    "fresh001", "hash_fresh_2");
            em.flush();
            em.clear();

            List<Device> result = repository.findStaleOnlineDevices(threshold);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("returns multiple stale devices")
        void returnsMultipleStaleDevices() {
            Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);

            persistDevice(stop1, DeviceStatus.ONLINE,
                    Instant.now().minus(10, ChronoUnit.MINUTES),
                    "stale001", "hash_stale_2");
            persistDevice(stop2, DeviceStatus.ONLINE,
                    Instant.now().minus(20, ChronoUnit.MINUTES),
                    "stale002", "hash_stale_3");
            persistDevice(stop3, DeviceStatus.ONLINE,
                    Instant.now().minus(30, ChronoUnit.MINUTES),
                    "stale003", "hash_stale_4");
            em.flush();
            em.clear();

            List<Device> result = repository.findStaleOnlineDevices(threshold);

            assertThat(result).hasSize(3);
        }

        @Test
        @DisplayName("returns empty list when no stale online devices exist")
        void returnsEmptyWhenNoStaleDevices() {
            Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);
            em.flush();
            em.clear();

            List<Device> result = repository.findStaleOnlineDevices(threshold);

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("handles ONLINE device with null lastHeartbeat (null < threshold is falsy in SQL)")
        void handlesNullLastHeartbeat() {
            Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES);

            // ONLINE with null heartbeat - SQL comparison with null returns unknown/false
            persistDevice(stop1, DeviceStatus.ONLINE, null, "null0001", "hash_null_1");
            em.flush();
            em.clear();

            List<Device> result = repository.findStaleOnlineDevices(threshold);

            // NULL < threshold evaluates to unknown in SQL, so device should NOT be returned
            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("excludes device with heartbeat exactly at the threshold")
        void excludesDeviceAtExactThreshold() {
            // Truncate to microseconds to match H2's timestamp precision
            Instant threshold = Instant.now().minus(5, ChronoUnit.MINUTES).truncatedTo(ChronoUnit.MICROS);

            // Heartbeat exactly at threshold - query uses < (strictly before)
            persistDevice(stop1, DeviceStatus.ONLINE, threshold, "exact001", "hash_exact_1");
            em.flush();
            em.clear();

            List<Device> result = repository.findStaleOnlineDevices(threshold);

            // lastHeartbeat < threshold is false when they are equal
            assertThat(result).isEmpty();
        }
    }

    @Nested
    @DisplayName("findAllWithStopAndLine")
    class FindAllWithStopAndLine {

        @Test
        @DisplayName("eagerly fetches stop and its lines for each device")
        void eagerlyFetchesStopAndLines() {
            persistDevice(stop1, DeviceStatus.ONLINE, Instant.now(), "dev00001", "hash_dev_1");
            em.flush();
            em.clear();

            List<Device> result = repository.findAllWithStopAndLine();

            assertThat(result).hasSize(1);
            Device device = result.getFirst();
            // These should not cause LazyInitializationException
            assertThat(device.getStop().getName()).isEqualTo("Central Station");
            assertThat(device.getStop().getLines()).hasSize(2);

            Set<String> lineCodes = device.getStop().getLines().stream()
                    .map(Line::getCode)
                    .collect(Collectors.toSet());
            assertThat(lineCodes).containsExactlyInAnyOrder("M1", "B2");
        }

        @Test
        @DisplayName("returns all devices across all stops")
        void returnsAllDevices() {
            persistDevice(stop1, DeviceStatus.ONLINE, Instant.now(), "dev00001", "hash_all_1");
            persistDevice(stop2, DeviceStatus.OFFLINE, null, "dev00002", "hash_all_2");
            persistDevice(stop3, DeviceStatus.ONLINE, Instant.now(), "dev00003", "hash_all_3");
            em.flush();
            em.clear();

            List<Device> result = repository.findAllWithStopAndLine();

            assertThat(result).hasSize(3);
        }

        @Test
        @DisplayName("returns empty list when no devices exist")
        void returnsEmptyWhenNoDevices() {
            em.flush();
            em.clear();

            List<Device> result = repository.findAllWithStopAndLine();

            assertThat(result).isEmpty();
        }

        @Test
        @DisplayName("does not return duplicate devices when stop has multiple lines")
        void noDuplicatesForMultiLineStops() {
            // stop1 has 2 lines (M1 and B2) - DISTINCT should prevent duplicates
            persistDevice(stop1, DeviceStatus.ONLINE, Instant.now(), "dev00001", "hash_dup_1");
            em.flush();
            em.clear();

            List<Device> result = repository.findAllWithStopAndLine();

            assertThat(result).hasSize(1);
        }

        @Test
        @DisplayName("handles multiple devices at the same stop")
        void handlesMultipleDevicesAtSameStop() {
            persistDevice(stop1, DeviceStatus.ONLINE, Instant.now(), "dev00001", "hash_multi_1");
            persistDevice(stop1, DeviceStatus.OFFLINE, null, "dev00002", "hash_multi_2");
            em.flush();
            em.clear();

            List<Device> result = repository.findAllWithStopAndLine();

            assertThat(result).hasSize(2);
            assertThat(result).allSatisfy(device ->
                    assertThat(device.getStop().getName()).isEqualTo("Central Station"));
        }
    }
}
