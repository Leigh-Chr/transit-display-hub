package com.transit.hub.infrastructure.seed.gtfs;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Covers the two paths that don't reach the real network: the classpath
 * fixture short-circuit and the cache-hit short-circuit. The HTTP path
 * stays out of scope here — it's exercised by the dev-feed integration
 * tests and by the real {@code testRealFeed} task.
 */
class GtfsDownloaderTest {

    private final Clock clock = Clock.fixed(Instant.parse("2026-05-18T10:00:00Z"), ZoneOffset.UTC);
    private final GtfsDownloader downloader = new GtfsDownloader(clock);

    @Test
    void downloadOrCached_zipsClasspathFixture() throws Exception {
        Path zip = downloader.downloadOrCached("classpath:fixtures/gtfs-rich/");

        assertNotNull(zip);
        assertTrue(Files.exists(zip));
        assertTrue(Files.size(zip) > 0);

        // The zip must contain at least one of the canonical GTFS entries
        // we know lives under fixtures/gtfs-rich/.
        boolean sawAgency = false;
        try (ZipInputStream zin = new ZipInputStream(Files.newInputStream(zip))) {
            ZipEntry entry;
            while ((entry = zin.getNextEntry()) != null) {
                if ("agency.txt".equals(entry.getName())) {
                    sawAgency = true;
                    break;
                }
            }
        }
        assertTrue(sawAgency, "fixture zip is missing agency.txt");
    }

    @Test
    void downloadOrCached_classpathFixtureWithoutTrailingSlashIsTolerated() throws Exception {
        Path zip = downloader.downloadOrCached("classpath:fixtures/gtfs-rich");
        assertNotNull(zip);
        assertTrue(Files.size(zip) > 0);
    }

    @Test
    void downloadOrCached_throwsWhenClasspathPatternMatchesNothing() {
        // The Spring resolver throws its own FileNotFoundException when the
        // base directory doesn't exist; an empty match raises the bespoke
        // "No GTFS fixture files" IOException. Either way the call must
        // fail rather than silently produce an empty zip.
        assertThrows(IOException.class,
                () -> downloader.downloadOrCached("classpath:fixtures/does-not-exist/"));
    }

    @Test
    void downloadOrCached_returnsCachedFileWhenFresh() throws Exception {
        // Pre-create the cache target file with a recent mtime so the
        // isFresh() short-circuit kicks in. The cache key is a SHA-256
        // truncated to 16 chars; we mirror the production hashing so the
        // test stays decoupled from the private helper.
        String feedUrl = "https://example.test/feed-cache-hit-" + System.nanoTime();
        Path cacheDir = Path.of(System.getProperty("java.io.tmpdir"), "transit-display-hub-gtfs");
        Files.createDirectories(cacheDir);

        Path target = cacheDir.resolve(hash16(feedUrl) + ".zip");
        Files.writeString(target, "cached-payload");
        Files.setLastModifiedTime(target, java.nio.file.attribute.FileTime.from(Instant.parse("2026-05-18T09:00:00Z")));

        // 1 hour ago + clock pinned at 10:00 ⇒ within the 24h TTL.
        Path resolved = downloader.downloadOrCached(feedUrl);

        assertEquals(target, resolved);
        // Make sure the file wasn't overwritten by an accidental HTTP call.
        assertEquals("cached-payload", Files.readString(resolved));

        // Cleanup so a flaky re-run doesn't carry the stale fixture.
        Files.deleteIfExists(target);
        Files.deleteIfExists(cacheDir.resolve(hash16(feedUrl) + ".meta"));
    }

    @Test
    void downloadOrCached_redownloadsWhenCacheIsStale() throws Exception {
        // Pre-create the cache file with a mtime older than the 24h TTL so
        // the freshness check fails. We don't want this test to hit the
        // network, so point at a URL guaranteed to fail DNS — we only
        // assert the cache file was NOT returned (the downloader either
        // returns a fresh fetch or throws).
        String feedUrl = "https://this-host-should-never-resolve-" + System.nanoTime() + ".invalid/feed.zip";
        Path cacheDir = Path.of(System.getProperty("java.io.tmpdir"), "transit-display-hub-gtfs");
        Files.createDirectories(cacheDir);

        Path target = cacheDir.resolve(hash16(feedUrl) + ".zip");
        Files.writeString(target, "stale-payload");
        Files.setLastModifiedTime(target, java.nio.file.attribute.FileTime.from(Instant.parse("2026-05-15T00:00:00Z")));

        // Either the HTTP attempt throws (preferred), or it somehow returns
        // a fresh file — both prove the stale cache wasn't blindly used.
        try {
            Path resolved = downloader.downloadOrCached(feedUrl);
            assertFalse("stale-payload".equals(Files.readString(resolved)),
                    "stale cache should not have been returned");
        } catch (IOException expected) {
            // Network unreachable / DNS failure: the freshness check did its
            // job by routing us to the HTTP path instead of returning the
            // stale cache file.
        } finally {
            Files.deleteIfExists(target);
            Files.deleteIfExists(cacheDir.resolve(hash16(feedUrl) + ".meta"));
        }
    }

    private static String hash16(String input) throws Exception {
        java.security.MessageDigest md = java.security.MessageDigest.getInstance("SHA-256");
        byte[] digest = md.digest(input.getBytes(java.nio.charset.StandardCharsets.UTF_8));
        return java.util.HexFormat.of().formatHex(digest).substring(0, 16);
    }
}
