package com.transit.hub.infrastructure.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.DistributionSummary;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Asserts the Micrometer meters the orchestrator surfaces to
 * /actuator/prometheus actually fire on each terminal outcome. Uses
 * {@link SimpleMeterRegistry} so the test stays in-process and the
 * tag-based counter slices are readable back without going through
 * the Prometheus scrape format.
 */
class GtfsImportMetricsTest {

    private MeterRegistry registry;
    private GtfsImportMetrics metrics;

    @BeforeEach
    void setUp() {
        registry = new SimpleMeterRegistry();
        metrics = new GtfsImportMetrics(registry);
    }

    @Test
    void registersThreeStatusSlicesOnTheCompletedCounter() {
        Counter success = registry.find("gtfs.import.completed").tag("status", "success").counter();
        Counter failed = registry.find("gtfs.import.completed").tag("status", "failed").counter();
        Counter skipped = registry.find("gtfs.import.completed").tag("status", "skipped").counter();
        assertNotNull(success);
        assertNotNull(failed);
        assertNotNull(skipped);
        assertEquals(0.0, success.count());
        assertEquals(0.0, failed.count());
        assertEquals(0.0, skipped.count());
    }

    @Test
    void recordSuccess_incrementsSuccessCounterAndStopsTheTimer() {
        Timer.Sample sample = metrics.startSample();
        metrics.recordSuccess(sample, 12, 30, 1500);

        Counter success = registry.find("gtfs.import.completed").tag("status", "success").counter();
        Timer timer = registry.find("gtfs.import.duration").timer();
        assertEquals(1.0, success.count());
        assertNotNull(timer);
        assertEquals(1L, timer.count(), "timer should have recorded one sample");
    }

    @Test
    void recordSuccess_publishesEntityCountsAsDistributionSummary() {
        Timer.Sample sample = metrics.startSample();
        metrics.recordSuccess(sample, 5, 25, 700);

        DistributionSummary lines = registry.find("gtfs.import.entities").tag("kind", "lines").summary();
        DistributionSummary stops = registry.find("gtfs.import.entities").tag("kind", "stops").summary();
        DistributionSummary schedules = registry.find("gtfs.import.entities").tag("kind", "schedules").summary();
        assertNotNull(lines);
        assertNotNull(stops);
        assertNotNull(schedules);
        assertEquals(1L, lines.count());
        assertEquals(5.0, lines.totalAmount());
        assertEquals(25.0, stops.totalAmount());
        assertEquals(700.0, schedules.totalAmount());
    }

    @Test
    void recordFailure_incrementsFailureCounterAndStopsTheTimer() {
        Timer.Sample sample = metrics.startSample();
        metrics.recordFailure(sample);

        Counter failed = registry.find("gtfs.import.completed").tag("status", "failed").counter();
        Timer timer = registry.find("gtfs.import.duration").timer();
        assertEquals(1.0, failed.count());
        assertEquals(1L, timer.count());
    }

    @Test
    void recordSkipped_incrementsSkippedCounterWithoutTouchingTheTimer() {
        metrics.recordSkipped();

        Counter skipped = registry.find("gtfs.import.completed").tag("status", "skipped").counter();
        Timer timer = registry.find("gtfs.import.duration").timer();
        assertEquals(1.0, skipped.count());
        // The skip path intentionally bypasses the duration timer — see the
        // javadoc on recordSkipped.
        assertTrue(timer == null || timer.count() == 0L);
    }

    @Test
    void successAndFailureAccumulate() {
        for (int i = 0; i < 3; i++) {
            metrics.recordSuccess(metrics.startSample(), 1, 1, 1);
        }
        metrics.recordFailure(metrics.startSample());
        metrics.recordFailure(metrics.startSample());

        Counter success = registry.find("gtfs.import.completed").tag("status", "success").counter();
        Counter failed = registry.find("gtfs.import.completed").tag("status", "failed").counter();
        assertEquals(3.0, success.count());
        assertEquals(2.0, failed.count());
    }
}
