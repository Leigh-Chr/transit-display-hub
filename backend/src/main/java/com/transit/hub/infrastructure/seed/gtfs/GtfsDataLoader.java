package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.User;
import com.transit.hub.domain.model.enums.UserRole;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.cache.CacheManager;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.nio.file.Path;

/**
 * Seeds the database from a standard GTFS feed.
 * Activated by app.data-loader.source=gtfs.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@ConditionalOnProperty(name = "app.data-loader.source", havingValue = "gtfs")
public class GtfsDataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final PasswordEncoder passwordEncoder;
    private final GtfsDownloader downloader;
    private final GtfsImportService importer;
    private final CacheManager cacheManager;

    @Value("${app.data-loader.gtfs.url}")
    private String feedUrl;

    @Value("${app.data-loader.gtfs.network-name:GTFS network}")
    private String networkName;

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0 || lineRepository.count() > 0) {
            log.info("Database already seeded, skipping GTFS import");
            return;
        }

        log.info("=== GTFS data seeding: {} ===", networkName);
        createUsers();

        try {
            Path feed = downloader.downloadOrCached(feedUrl);
            GtfsImportService.ImportResult result = importer.importFromZip(feed);
            // The frontend may have hit /api/network-map while routes/stops were
            // still being persisted, caching an empty snapshot. Drop those caches
            // so the next request rebuilds from the populated database.
            evictNetworkCaches();
            logSummary(result);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("GTFS import interrupted", e);
        } catch (Exception e) {
            log.error("GTFS import failed for {}: {}. Application will start without network data.",
                    feedUrl, e.getMessage(), e);
        }
    }

    private void createUsers() {
        userRepository.save(User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build());

        userRepository.save(User.builder()
                .username("supervisor")
                .password(passwordEncoder.encode("super123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .build());

        userRepository.save(User.builder()
                .username("agent")
                .password(passwordEncoder.encode("agent123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build());

        userRepository.save(User.builder()
                .username("operator1")
                .password(passwordEncoder.encode("oper123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build());

        userRepository.save(User.builder()
                .username("operator2")
                .password(passwordEncoder.encode("oper123"))
                .role(UserRole.AGENT)
                .enabled(true)
                .build());

        log.info("Created {} users", userRepository.count());
    }

    private void evictNetworkCaches() {
        for (String name : new String[]{"networkMap", "networkAlerts"}) {
            var cache = cacheManager.getCache(name);
            if (cache != null) {cache.clear();}
        }
    }

    private void logSummary(GtfsImportService.ImportResult r) {
        if (!log.isInfoEnabled()) {
            return;
        }
        log.info("========================================");
        log.info("       GTFS SEEDING SUMMARY            ");
        log.info("========================================");
        log.info("Network:        {}", networkName);
        log.info("Source:         {}", feedUrl);
        log.info("Users:          {}", userRepository.count());
        log.info("Lines:          {}", r.lines());
        log.info("Stops:          {}", r.stops());
        log.info("Itineraries:    {}", r.itineraries());
        log.info("Itinerary stops:{}", r.itineraryStops());
        log.info("========================================");
        log.info("Default login: admin / admin123");
        log.info("========================================");
    }
}
