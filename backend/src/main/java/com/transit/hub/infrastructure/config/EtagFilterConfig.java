package com.transit.hub.infrastructure.config;

import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.filter.ShallowEtagHeaderFilter;

/**
 * Adds shallow ETag support on cacheable read endpoints. The filter computes
 * an MD5 of the response body and short-circuits with 304 Not Modified when
 * the client returns the same If-None-Match — saving bandwidth on the heavy
 * /api/network-map and /api/lines payloads that change rarely.
 */
@Configuration
public class EtagFilterConfig {

    @Bean
    public FilterRegistrationBean<ShallowEtagHeaderFilter> shallowEtagHeaderFilter() {
        FilterRegistrationBean<ShallowEtagHeaderFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new ShallowEtagHeaderFilter());
        registration.setName("etagFilter");
        // Restrict to cacheable read paths — applying the filter globally would
        // buffer every response (including streaming endpoints) into memory.
        registration.addUrlPatterns(
                "/api/network-map/*",
                "/api/network-map",
                "/api/lines",
                "/api/lines/*",
                "/api/stops",
                "/api/stops/*",
                "/api/itineraries",
                "/api/itineraries/*"
        );
        return registration;
    }
}
