package com.transit.hub.infrastructure.seed.gtfs;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Optional;

/**
 * Downloads a GTFS feed and caches it locally with a configurable TTL.
 * <p>
 * On cache miss the downloader sends {@code If-Modified-Since} and
 * {@code If-None-Match} based on the previous response's {@code Last-Modified}
 * and {@code ETag} headers (stored in a sidecar metadata file). When the
 * server replies with {@code 304 Not Modified} the cached zip is reused
 * even if the local TTL has lapsed — this is the cheap path for
 * self-hosted feeds that change at most weekly.
 */
@Component
@Slf4j
public class GtfsDownloader {

    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(30);
    private static final Duration REQUEST_TIMEOUT = Duration.ofMinutes(2);
    private static final Duration DEFAULT_TTL = Duration.ofHours(24);
    private static final String CACHE_SUBDIR = "transit-display-hub-gtfs";

    public Path downloadOrCached(String feedUrl) throws IOException, InterruptedException {
        Path cacheDir = Path.of(System.getProperty("java.io.tmpdir"), CACHE_SUBDIR);
        Files.createDirectories(cacheDir);

        Path target = cacheDir.resolve(hash(feedUrl) + ".zip");
        Path meta = cacheDir.resolve(hash(feedUrl) + ".meta");

        if (isFresh(target, DEFAULT_TTL)) {
            log.info("GTFS feed cache hit: {} (age: {})", target, ageOf(target));
            return target;
        }

        log.info("Downloading GTFS feed from {}", feedUrl);
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(CONNECT_TIMEOUT)
                .build();

        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(feedUrl))
                .timeout(REQUEST_TIMEOUT)
                .GET();
        CachedHeaders cached = readCachedHeaders(meta);
        if (Files.exists(target) && cached != null) {
            cached.lastModified().ifPresent(v -> builder.header("If-Modified-Since", v));
            cached.etag().ifPresent(v -> builder.header("If-None-Match", v));
        }

        Path tmp = Files.createTempFile(cacheDir, "download-", ".zip.tmp");
        HttpResponse<Path> response = client.send(builder.build(), HttpResponse.BodyHandlers.ofFile(tmp));

        if (response.statusCode() == 304 && Files.exists(target)) {
            // Server confirmed the cached copy is current. Touch the file so
            // future calls within DEFAULT_TTL can short-circuit on isFresh.
            Files.deleteIfExists(tmp);
            Files.setLastModifiedTime(target, java.nio.file.attribute.FileTime.from(Instant.now()));
            log.info("GTFS feed unchanged (304 Not Modified) — reusing cached copy: {}", target);
            return target;
        }

        if (response.statusCode() / 100 != 2) {
            Files.deleteIfExists(tmp);
            throw new IOException("GTFS download failed: HTTP " + response.statusCode() + " from " + feedUrl);
        }

        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        writeCachedHeaders(meta,
                response.headers().firstValue("Last-Modified").orElse(null),
                response.headers().firstValue("ETag").orElse(null));
        log.info("GTFS feed downloaded: {} ({} bytes)", target, Files.size(target));
        return target;
    }

    private static boolean isFresh(Path path, Duration ttl) throws IOException {
        if (!Files.exists(path)) {
            return false;
        }
        Instant modified = Files.getLastModifiedTime(path).toInstant();
        return Duration.between(modified, Instant.now()).compareTo(ttl) < 0;
    }

    private static Duration ageOf(Path path) throws IOException {
        return Duration.between(Files.getLastModifiedTime(path).toInstant(), Instant.now());
    }

    /**
     * Sidecar metadata file holding the cache-validation headers from the
     * last successful response. Plain-text "key: value" lines so the file
     * can be inspected with a simple {@code cat} during debugging.
     */
    private record CachedHeaders(Optional<String> lastModified, Optional<String> etag) {}

    private static CachedHeaders readCachedHeaders(Path meta) {
        if (!Files.exists(meta)) {
            return null;
        }
        try {
            String lastModified = null;
            String etag = null;
            for (String line : Files.readAllLines(meta, StandardCharsets.UTF_8)) {
                int sep = line.indexOf(':');
                if (sep < 0) { continue; }
                String key = line.substring(0, sep).trim().toLowerCase();
                String value = line.substring(sep + 1).trim();
                if (value.isEmpty()) { continue; }
                if ("last-modified".equals(key)) { lastModified = value; }
                else if ("etag".equals(key)) { etag = value; }
            }
            return new CachedHeaders(Optional.ofNullable(lastModified), Optional.ofNullable(etag));
        } catch (IOException e) {
            log.warn("Failed to read GTFS cache metadata {}: {}", meta, e.getMessage());
            return null;
        }
    }

    private static void writeCachedHeaders(Path meta, String lastModified, String etag) {
        if (lastModified == null && etag == null) {
            // Nothing to remember — drop a stale meta file so the next call
            // doesn't replay yesterday's headers against today's response.
            try {
                Files.deleteIfExists(meta);
            } catch (IOException ignored) {
                // best effort
            }
            return;
        }
        StringBuilder sb = new StringBuilder();
        if (lastModified != null) {
            sb.append("Last-Modified: ").append(lastModified).append('\n');
        }
        if (etag != null) {
            sb.append("ETag: ").append(etag).append('\n');
        }
        try {
            Files.writeString(meta, sb.toString(), StandardCharsets.UTF_8);
        } catch (IOException e) {
            log.warn("Failed to write GTFS cache metadata {}: {}", meta, e.getMessage());
        }
    }

    private static String hash(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(input.getBytes());
            return HexFormat.of().formatHex(digest).substring(0, 16);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }
}
