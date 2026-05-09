package com.transit.hub.infrastructure.config;

import com.github.benmanes.caffeine.cache.Caffeine;
import org.springframework.cache.CacheManager;
import org.springframework.cache.caffeine.CaffeineCacheManager;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.time.Duration;

@Configuration
public class CacheConfig {

    @Bean
    public CacheManager cacheManager() {
        // recordStats() so Micrometer's CaffeineCacheMetrics gets the
        // hit / miss / load counters it needs — without it the actuator
        // logs a startup warning that only cache.size will be exposed.
        CaffeineCacheManager manager = new CaffeineCacheManager();
        manager.registerCustomCache("networkMap",
                Caffeine.newBuilder()
                        .maximumSize(1)
                        .expireAfterWrite(Duration.ofMinutes(5))
                        .recordStats()
                        .build());
        manager.registerCustomCache("networkAlerts",
                Caffeine.newBuilder()
                        .maximumSize(1)
                        .expireAfterWrite(Duration.ofMinutes(1))
                        .recordStats()
                        .build());
        return manager;
    }
}
