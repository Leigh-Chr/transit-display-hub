package com.transit.hub.infrastructure.metrics;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.stereotype.Component;

/**
 * Custom Micrometer instrumentation around the GTFS import flow.
 *
 * <p>Surfaces three signals on the {@code /actuator/prometheus} scrape:
 * <ul>
 *   <li>{@code gtfs.import.duration} — Timer wrapping every attempt that
 *       ran past the orchestrator's lock guard. The {@code application.yml}
 *       enables the histogram on this name so Grafana can display
 *       quantile bands.</li>
 *   <li>{@code gtfs.import.completed} — Counter sliced by {@code status}
 *       tag ({@code success}, {@code failed}, {@code skipped}). Lets ops
 *       set up "no successful import in 24 h" alerts without parsing the
 *       audit table.</li>
 *   <li>{@code gtfs.import.entities} — Distribution summary of the import
 *       size (lines + stops + schedules) so we have ground truth on what
 *       a "healthy" import looks like before alerting on a 50 % drop.</li>
 * </ul>
 *
 * <p>Why a dedicated component rather than annotation-driven {@code @Timed}:
 * the orchestrator already owns the success / failure branching and the
 * {@link io.micrometer.core.instrument.Counter} tag depends on it. Doing it
 * by hand keeps the call sites obvious in the orchestrator instead of
 * scattering labels across @{@link io.micrometer.core.annotation.Timed}.
 */
@Component
public class GtfsImportMetrics {

    private final Timer durationTimer;
    private final Counter successCounter;
    private final Counter failureCounter;
    private final Counter skippedCounter;
    private final MeterRegistry registry;

    public GtfsImportMetrics(MeterRegistry registry) {
        this.registry = registry;
        this.durationTimer = Timer.builder("gtfs.import.duration")
                .description("Wall-clock duration of a single GTFS import attempt")
                .publishPercentiles(0.5, 0.95, 0.99)
                .register(registry);
        this.successCounter = Counter.builder("gtfs.import.completed")
                .description("GTFS import attempts that completed, sliced by outcome")
                .tag("status", "success")
                .register(registry);
        this.failureCounter = Counter.builder("gtfs.import.completed")
                .description("GTFS import attempts that completed, sliced by outcome")
                .tag("status", "failed")
                .register(registry);
        this.skippedCounter = Counter.builder("gtfs.import.completed")
                .description("GTFS import attempts that completed, sliced by outcome")
                .tag("status", "skipped")
                .register(registry);
    }

    /** Start a sample to be stopped by {@link #recordSuccess} or
     *  {@link #recordFailure}. The orchestrator owns the lifetime — a
     *  sample that's never stopped silently leaks Micrometer state, but
     *  the orchestrator's {@code try / finally} structure guarantees one
     *  terminal call per started sample. */
    public Timer.Sample startSample() {
        return Timer.start(registry);
    }

    public void recordSuccess(Timer.Sample sample, long lines, long stops, long schedules) {
        sample.stop(durationTimer);
        successCounter.increment();
        registry.summary("gtfs.import.entities", "kind", "lines").record(lines);
        registry.summary("gtfs.import.entities", "kind", "stops").record(stops);
        registry.summary("gtfs.import.entities", "kind", "schedules").record(schedules);
    }

    public void recordFailure(Timer.Sample sample) {
        sample.stop(durationTimer);
        failureCounter.increment();
    }

    /** Concurrent-skip path — the orchestrator's lock blocked the
     *  attempt before any work happened, so there's no duration to
     *  record (would skew the histogram with near-zero values). */
    public void recordSkipped() {
        skippedCounter.increment();
    }
}
