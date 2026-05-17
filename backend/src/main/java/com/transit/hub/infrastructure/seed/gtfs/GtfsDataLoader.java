package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.application.service.GtfsImportOrchestrator;
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
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * One-shot bootstrap loader. Creates the default users and triggers a
 * single GTFS import via {@link GtfsImportOrchestrator}; the heavy lifting
 * (download, hash, import, audit, cache eviction) lives in the orchestrator
 * so the same path is reused by the cron-driven refresh and any future
 * admin-triggered re-import.
 *
 * Activated by {@code app.data-loader.source=gtfs}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
@Profile("dev")
@ConditionalOnProperty(name = "app.data-loader.source", havingValue = "gtfs")
public class GtfsDataLoader implements CommandLineRunner {

    private final UserRepository userRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final PasswordEncoder passwordEncoder;
    private final GtfsImportOrchestrator orchestrator;

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

        GtfsImportOrchestrator.ImportOutcome outcome = orchestrator.runImport(feedUrl, "boot");
        if (outcome.result() != null) {
            logSummary(outcome.result());
        } else {
            log.warn("GTFS bootstrap import did not return a result: {}", outcome.message());
        }
    }

    private void createUsers() {
        // Match Flyway V52's intent — the seeded admin must rotate on first
        // login. The dev profile re-creates this user from scratch on every
        // boot (H2 is in-memory), so without this flag we'd silently drift
        // away from the production behaviour the e2e suite relies on.
        userRepository.save(User.builder()
                .username("admin")
                .password(passwordEncoder.encode("admin123"))
                .role(UserRole.ADMIN)
                .enabled(true)
                .passwordMustChange(true)
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
        log.info("Schedules:      {}", r.schedules());
        log.info("========================================");
        // Seeded credentials are documented in CONTRIBUTING.md / .env.example;
        // logging them on every boot would publish a valid login to whatever
        // log collector the operator wires up.
    }
}
