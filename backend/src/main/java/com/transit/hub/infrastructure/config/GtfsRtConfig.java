package com.transit.hub.infrastructure.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.concurrent.Executors;

/**
 * Shared HTTP client used by the three GTFS-Realtime caches (alerts,
 * trip updates, vehicle positions). Sharing a single client keeps the
 * connection pool warm across feeds and lets the JDK reuse virtual
 * threads (Java 21) when more than one cache refreshes at the same
 * tick — instead of pinning each refresh to its own kernel thread.
 */
@Configuration
public class GtfsRtConfig {

    @Bean
    public HttpClient gtfsRtHttpClient() {
        return HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(10))
                .executor(Executors.newVirtualThreadPerTaskExecutor())
                .build();
    }
}
