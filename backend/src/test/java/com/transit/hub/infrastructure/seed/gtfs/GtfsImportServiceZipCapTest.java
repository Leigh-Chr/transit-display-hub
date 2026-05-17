package com.transit.hub.infrastructure.seed.gtfs;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Direct coverage of {@link GtfsImportService#extractZip(Path, Path, long, long)}
 * with low caps. Goes around the Spring context — the method is static
 * and IO-only, so the integration tests in {@code *IntegrationTest}
 * cover the happy path with realistic limits, and this suite focuses
 * on the defensive paths.
 */
class GtfsImportServiceZipCapTest {

    private Path zipFile;
    private Path targetDir;

    @BeforeEach
    void setUp() throws IOException {
        zipFile = Files.createTempFile("zipcap-", ".zip");
        targetDir = Files.createTempDirectory("zipcap-target-");
    }

    @AfterEach
    void tearDown() throws IOException {
        Files.deleteIfExists(zipFile);
        if (Files.exists(targetDir)) {
            try (var s = Files.walk(targetDir)) {
                s.sorted((a, b) -> b.getNameCount() - a.getNameCount())
                        .forEach(p -> {
                            try { Files.deleteIfExists(p); } catch (IOException ignored) { /* best effort */ }
                        });
            }
        }
    }

    @Test
    void extractsRegularEntriesUnderTheCaps() throws IOException {
        writeZip(z -> {
            putEntry(z, "agency.txt", "agency_id,agency_name\n1,Test\n".getBytes());
            putEntry(z, "stops.txt", "stop_id,stop_name\n1,Foo\n".getBytes());
        });

        GtfsImportService.extractZip(zipFile, targetDir, 1024, 4096);

        assertThat(Files.readString(targetDir.resolve("agency.txt"))).contains("Test");
        assertThat(Files.readString(targetDir.resolve("stops.txt"))).contains("Foo");
    }

    @Test
    void rejectsEntryAboveTheEntryCap() throws IOException {
        byte[] payload = new byte[2048];
        writeZip(z -> putEntry(z, "stop_times.txt", payload));

        assertThatThrownBy(() -> GtfsImportService.extractZip(zipFile, targetDir, 512, 8192))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Zip entry exceeds 512 bytes")
                .hasMessageEndingWith("stop_times.txt");
    }

    @Test
    void rejectsAggregateAboveTheTotalCap() throws IOException {
        byte[] payload = new byte[200];
        writeZip(z -> {
            putEntry(z, "a.txt", payload);
            putEntry(z, "b.txt", payload);
            putEntry(z, "c.txt", payload);
        });

        assertThatThrownBy(() -> GtfsImportService.extractZip(zipFile, targetDir, 4096, 500))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Zip archive exceeds total cap of 500 bytes");
    }

    @Test
    void stillBlocksZipSlipBeforeReadingTheEntry() throws IOException {
        writeZip(z -> putEntry(z, "../escape.txt", "boom".getBytes()));

        assertThatThrownBy(() -> GtfsImportService.extractZip(zipFile, targetDir, 1024, 4096))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageStartingWith("Zip entry outside target:");
    }

    @FunctionalInterface
    private interface ZipBody {
        void accept(ZipOutputStream z) throws IOException;
    }

    private void writeZip(ZipBody body) throws IOException {
        try (OutputStream raw = Files.newOutputStream(zipFile);
             ZipOutputStream zip = new ZipOutputStream(raw)) {
            body.accept(zip);
        }
    }

    private static void putEntry(ZipOutputStream zip, String name, byte[] payload) {
        try {
            zip.putNextEntry(new ZipEntry(name));
            zip.write(payload);
            zip.closeEntry();
        } catch (IOException e) {
            throw new IllegalStateException("test fixture", e);
        }
    }
}
