package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.application.dto.response.DataOverviewResponse;
import com.transit.hub.application.service.DataOverviewService;
import com.transit.hub.infrastructure.persistence.AgencyRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * End-to-end test of {@link GtfsImportService} against a synthetic
 * minimal feed checked into {@code src/test/resources/fixtures/
 * gtfs-minimal/}. No Internet, no flakiness, but exercises every
 * mandatory GTFS file plus a parent_station + platform hierarchy so
 * the per-platform-stops path runs end to end.
 *
 * The fixture contains:
 *   - 1 agency, 2 routes (M1 metro + B1 bus)
 *   - 5 stops: 1 parent station, 2 platform children, 2 free-standing
 *   - 4 trips × 2-3 stop_times each
 *   - WEEKDAY + WEEKEND calendars
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@DisplayName("GtfsImportService Integration — minimal synthetic feed")
class GtfsImportServiceIntegrationTest {

    private static final String FIXTURE_DIR = "fixtures/gtfs-minimal/";
    private static final String[] FEED_FILES = {
            "agency.txt", "routes.txt", "stops.txt", "calendar.txt",
            "trips.txt", "stop_times.txt", "locations.geojson"
    };

    @Autowired private GtfsImportService importer;
    @Autowired private DataOverviewService dataOverviewService;
    @Autowired private AgencyRepository agencyRepository;
    @Autowired private LineRepository lineRepository;
    @Autowired private StopRepository stopRepository;
    @Autowired private ScheduleRepository scheduleRepository;
    @Autowired private ServiceCalendarRepository serviceCalendarRepository;
    @Autowired private LocationRepository locationRepository;

    @TempDir Path tempDir;

    @BeforeEach
    void cleanup() {
        // Test profile uses an in-memory H2 with create-drop, but the
        // @Transactional rollback doesn't reset the import-side
        // collections that have CASCADE rules. Wipe to be safe.
        scheduleRepository.deleteAll();
        stopRepository.deleteAll();
        lineRepository.deleteAll();
        agencyRepository.deleteAll();
        serviceCalendarRepository.deleteAll();
    }

    @Test
    @DisplayName("imports the synthetic feed end-to-end and persists every entity family")
    void importsMinimalFeed() throws IOException {
        Path zipPath = buildFixtureZip(tempDir.resolve("minimal.zip"));

        GtfsImportService.ImportResult result = importer.importFromZip(zipPath);

        // Counts from fixtures/gtfs-minimal:
        //   agencies = 1, lines = 2 (M1, B1), stops = 5
        //   itineraries = 3 (M1 north, M1 south, B1 north — B1's two
        //     trips for WEEKDAY+WEEKEND collapse to one itinerary
        //     because they share route + direction + stop sequence)
        //   itineraryStops = 2+2+3 = 7
        //   schedules = sum of stop_times rows = 10
        assertThat(result.lines()).isEqualTo(2);
        assertThat(result.stops()).isEqualTo(5);
        assertThat(result.itineraries()).isGreaterThanOrEqualTo(3);
        assertThat(result.itineraryStops()).isGreaterThanOrEqualTo(7);
        assertThat(result.schedules()).isEqualTo(10);
    }

    @Test
    @DisplayName("parent station + platform children land with the right hierarchy")
    void persistsParentStationHierarchy() throws IOException {
        Path zipPath = buildFixtureZip(tempDir.resolve("hierarchy.zip"));
        importer.importFromZip(zipPath);

        var stops = stopRepository.findAll();
        var parents = stops.stream().filter(s -> s.getLocationType() == 1).toList();
        var platforms = stops.stream()
                .filter(s -> s.getParentStop() != null).toList();

        assertThat(parents).hasSize(1);
        assertThat(parents.get(0).getName()).isEqualTo("Central Station");
        assertThat(platforms).hasSize(2);
        assertThat(platforms).extracting("platformCode")
                .containsExactlyInAnyOrder("A", "B");
        assertThat(platforms).allSatisfy(p ->
                assertThat(p.getParentStop().getId())
                        .isEqualTo(parents.get(0).getId()));
    }

    @Test
    @DisplayName("locations.geojson polygons land with their bounding box computed")
    void persistsLocationsGeoJson() throws IOException {
        Path zipPath = buildFixtureZip(tempDir.resolve("locations.zip"));
        importer.importFromZip(zipPath);

        var locations = locationRepository.findAll();
        assertThat(locations).hasSize(2);
        assertThat(locations).extracting("externalId")
                .containsExactlyInAnyOrder("FLEX_ZONE_NORTH", "FLEX_ZONE_SOUTH");

        var north = locations.stream()
                .filter(l -> "FLEX_ZONE_NORTH".equals(l.getExternalId())).findFirst().orElseThrow();
        assertThat(north.getName()).isEqualTo("Flexible service zone — North");
        assertThat(north.getGeometryType()).isEqualTo("Polygon");
        assertThat(north.getMinLatitude()).isEqualTo(45.18);
        assertThat(north.getMaxLatitude()).isEqualTo(45.20);
        assertThat(north.getMinLongitude()).isEqualTo(5.70);
        assertThat(north.getMaxLongitude()).isEqualTo(5.75);
        assertThat(north.getGeometryJson()).contains("Polygon").contains("coordinates");
    }

    @Test
    @DisplayName("data-overview snapshot reflects the imported counts")
    void dataOverviewAfterImport() throws IOException {
        Path zipPath = buildFixtureZip(tempDir.resolve("overview.zip"));
        importer.importFromZip(zipPath);

        DataOverviewResponse overview = dataOverviewService.current();
        assertThat(overview.staticGtfs().agencies()).isEqualTo(1);
        assertThat(overview.staticGtfs().lines()).isEqualTo(2);
        assertThat(overview.staticGtfs().stops()).isEqualTo(5);
        assertThat(overview.staticGtfs().schedules()).isEqualTo(10);
    }

    /** Zips every CSV in {@link #FIXTURE_DIR} into {@code zipPath}. */
    private Path buildFixtureZip(Path zipPath) throws IOException {
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
            for (String file : FEED_FILES) {
                try (InputStream in = getClass().getClassLoader()
                        .getResourceAsStream(FIXTURE_DIR + file)) {
                    if (in == null) {
                        throw new IOException("Missing fixture: " + FIXTURE_DIR + file);
                    }
                    zos.putNextEntry(new ZipEntry(file));
                    in.transferTo(zos);
                    zos.closeEntry();
                }
            }
        }
        return Paths.get(zipPath.toString());
    }
}
