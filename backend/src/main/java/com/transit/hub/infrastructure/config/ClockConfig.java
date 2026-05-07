package com.transit.hub.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Clock;

/**
 * Provides a single {@link Clock} bean. Domain services that read "now"
 * (DisplayStateCalculator, schedule windows, etc.) consume this clock
 * instead of {@code LocalTime.now()} / {@code Instant.now()} so tests
 * can pin time deterministically without brittle wall-clock dependencies.
 */
@Configuration
public class ClockConfig {

    @Bean
    public Clock clock() {
        return Clock.systemDefaultZone();
    }
}
