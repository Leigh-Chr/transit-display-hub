package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.infrastructure.persistence.AgencyRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.file.Path;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke test for the GTFS importer against real published feeds.
 * Tagged {@code real-feed} so the default {@code ./gradlew test} task
 * skips it (see build.gradle.kts) — runs only via
 * {@code ./gradlew testRealFeed}, which is opt-in and Internet-aware.
 *
 * Each parameterised case downloads a feed, runs the full
 * {@link GtfsImportService#importFromZip(Path)} pipeline, and asserts
 * a non-trivial domain shape was persisted (≥ 1 agency, ≥ 1 line,
 * ≥ 100 stops, ≥ 1000 schedules). Counts vary across operators so the
 * thresholds stay loose; the assertion is "the import produced
 * something coherent", not "this exact number".
 *
 * Each test self-skips via {@link Assumptions} when the upstream URL
 * is unreachable — a network outage or operator downtime should not
 * fail the build, only mark the test as skipped.
 */
@SpringBootTest
@ActiveProfiles("test")
@Tag("real-feed")
@Transactional
@DisplayName("GTFS importer — real public feeds")
class RealGtfsFeedIntegrationTest {

    @Autowired private GtfsImportService importer;
    @Autowired private GtfsDownloader downloader;
    @Autowired private AgencyRepository agencyRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private StopRepository stopRepository;
    @Autowired private ScheduleRepository scheduleRepository;
    @Autowired private ServiceCalendarRepository serviceCalendarRepository;

    @BeforeEach
    void cleanup() {
        scheduleRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        agencyRepository.deleteAll();
        serviceCalendarRepository.deleteAll();
    }

    static Stream<Arguments> publicFeeds() {
        return Stream.of(
                Arguments.of("M Réso Grenoble",
                        "https://data.mobilites-m.fr/api/gtfs/SEM"),
                Arguments.of("CTS Strasbourg",
                        "https://opendata.cts-strasbourg.eu/google_transit.zip"),
                Arguments.of("TBM Bordeaux",
                        "https://bdx.mecatran.com/utw/ws/gtfsfeed/static/bordeaux"
                                + "?apiKey=opendata-bordeaux-metropole-flux-gtfs-rt")
        );
    }

    @ParameterizedTest(name = "{0}")
    @MethodSource("publicFeeds")
    @DisplayName("downloads and imports a published feed end-to-end")
    void importsPublicFeed(String name, String url) throws Exception {
        Assumptions.assumeTrue(reachable(url),
                "Skipping " + name + ": upstream unreachable (" + url + ")");

        Path feed = downloader.downloadOrCached(url);
        GtfsImportService.ImportResult result = importer.importFromZip(feed, url, null);

        assertThat(result.lines())
                .as("%s should expose at least one route", name)
                .isGreaterThanOrEqualTo(1);
        assertThat(result.stops())
                .as("%s should publish a non-trivial number of stops", name)
                .isGreaterThanOrEqualTo(50);
        assertThat(result.itineraries())
                .as("%s should produce at least one itinerary per route", name)
                .isGreaterThanOrEqualTo(result.lines());
        assertThat(result.schedules())
                .as("%s should publish at least 1k schedules across the loaded calendars", name)
                .isGreaterThanOrEqualTo(1_000);
    }

    /** HEAD-checks the URL with a short timeout. Returns true if the
     *  remote responds with anything below 500. Anything else is a
     *  good enough signal to skip the test rather than fail. */
    private boolean reachable(String url) {
        try {
            HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
            conn.setRequestMethod("HEAD");
            conn.setConnectTimeout(5_000);
            conn.setReadTimeout(5_000);
            conn.setInstanceFollowRedirects(true);
            int code = conn.getResponseCode();
            conn.disconnect();
            return code < 500;
        } catch (IOException e) {
            return false;
        }
    }
}
