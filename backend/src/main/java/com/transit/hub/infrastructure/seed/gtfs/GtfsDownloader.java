package com.transit.hub.infrastructure.seed.gtfs;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;

/**
 * Downloads a GTFS feed and caches it locally with a configurable TTL.
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
        if (isFresh(target, DEFAULT_TTL)) {
            log.info("GTFS feed cache hit: {} (age: {})", target, ageOf(target));
            return target;
        }

        log.info("Downloading GTFS feed from {}", feedUrl);
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.NORMAL)
                .connectTimeout(CONNECT_TIMEOUT)
                .build();

        HttpRequest request = HttpRequest.newBuilder(URI.create(feedUrl))
                .timeout(REQUEST_TIMEOUT)
                .GET()
                .build();

        Path tmp = Files.createTempFile(cacheDir, "download-", ".zip.tmp");
        HttpResponse<Path> response = client.send(request, HttpResponse.BodyHandlers.ofFile(tmp));

        if (response.statusCode() / 100 != 2) {
            Files.deleteIfExists(tmp);
            throw new IOException("GTFS download failed: HTTP " + response.statusCode() + " from " + feedUrl);
        }

        Files.move(tmp, target, java.nio.file.StandardCopyOption.REPLACE_EXISTING,
                java.nio.file.StandardCopyOption.ATOMIC_MOVE);
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
