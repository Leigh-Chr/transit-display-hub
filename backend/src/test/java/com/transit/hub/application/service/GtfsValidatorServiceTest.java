package com.transit.hub.application.service;

import com.transit.hub.application.service.GtfsValidatorService.ValidationResult;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.util.stream.Stream;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Smoke test for the MobilityData runner wrapper. Zips the
 * {@code gtfs-rich} classpath fixture into a temporary archive,
 * runs the validator against it, and asserts the three report files
 * are produced. The exercise also confirms the dependency wiring
 * (gtfs-validator-main + core, transitive Gson, Guava) is intact.
 *
 * <p>The test is intentionally agnostic to the notice content —
 * it only verifies the runner completes and writes report.json
 * back to disk. Notice-level assertions belong in integration
 * tests once we wire the report into ImportAudit.
 */
class GtfsValidatorServiceTest {

    @Test
    void validatesGtfsRichFixtureAndProducesReports(@TempDir Path workDir) throws IOException {
        Path feedZip = zipClasspathFixture("fixtures/gtfs-rich/", workDir.resolve("gtfs-rich.zip"));
        Path outputDir = workDir.resolve("validator-output");

        ValidationResult result = new GtfsValidatorService(java.time.Clock.systemUTC())
                .validate(feedZip, outputDir, "FR", LocalDate.of(2026, 5, 10));

        assertThat(result.success()).isTrue();
        assertThat(result.reportJsonPath()).exists();
        assertThat(result.reportHtmlPath()).exists();
        // system_errors.json is only written when something blew up
        // inside the runner — its absence on a clean run is expected.
    }

    private static Path zipClasspathFixture(String classpathPrefix, Path target) throws IOException {
        Path source = Paths.get("src/main/resources/" + classpathPrefix);
        try (OutputStream fos = Files.newOutputStream(target);
             ZipOutputStream zos = new ZipOutputStream(fos);
             Stream<Path> entries = Files.walk(source)) {
            entries.filter(Files::isRegularFile).forEach(p -> {
                try {
                    String name = source.relativize(p).toString().replace('\\', '/');
                    zos.putNextEntry(new ZipEntry(name));
                    Files.copy(p, zos);
                    zos.closeEntry();
                } catch (IOException e) {
                    throw new RuntimeException("zip failed for " + p, e);
                }
            });
        }
        return target;
    }
}
