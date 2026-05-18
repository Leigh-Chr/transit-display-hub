package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import lombok.extern.slf4j.Slf4j;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Objects;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Common HTTP-fetch-parse-store skeleton shared by the three GTFS-Realtime
 * feed caches (alerts, trip updates, vehicle positions).
 *
 * <p>Each subclass declares its feed URL, request timeout, a human-readable
 * kind label for log lines, and the domain-specific parse and empty-snapshot
 * methods. The {@link #refresh()} loop is implemented once here so the three
 * concrete caches only carry the logic that actually differs.
 *
 * <p>The {@link HttpClient} is provided by the Spring container
 * ({@code GtfsRtConfig#gtfsRtHttpClient}) so the three caches share the
 * same connection pool and virtual-thread executor.
 *
 * @param <S> the snapshot type held by this cache
 */
@Slf4j
abstract class AbstractRealtimeFeedCache<S> {

    protected final HttpClient http;

    protected final AtomicReference<S> snapshot = new AtomicReference<>(emptySnapshot());

    protected final AtomicReference<FeedHeaderInfo> headerRef =
            new AtomicReference<>(FeedHeaderInfo.empty());

    protected AbstractRealtimeFeedCache(HttpClient http) {
        this.http = http;
    }

    // ------------------------------------------------------------------ //
    // Contract for subclasses                                              //
    // ------------------------------------------------------------------ //

    /** The feed URL to poll, or an empty / null string when the feed is not configured. */
    protected abstract String feedUrl();

    /** HTTP request timeout in seconds. */
    protected abstract int timeoutSeconds();

    /**
     * A short label used in log lines, e.g. {@code "alerts"},
     * {@code "trip updates"}, {@code "vehicle positions"}.
     */
    protected abstract String kindLabel();

    /** Parse the raw {@link GtfsRealtime.FeedMessage} into a typed snapshot. */
    protected abstract S parseSnapshot(GtfsRealtime.FeedMessage feed);

    /** Initial snapshot value placed in the cache before the first refresh. */
    protected abstract S emptySnapshot();

    /** Number of entries in the snapshot — used in the refresh log line. */
    protected abstract int countEntries(S snap);

    // ------------------------------------------------------------------ //
    // Public API                                                           //
    // ------------------------------------------------------------------ //

    public boolean isEnabled() {
        String url = feedUrl();
        return url != null && !url.isBlank();
    }

    public S getSnapshot() {
        // AtomicReference.get() is @Nullable in its signature, but the
        // constructor seeds the reference with emptySnapshot() and every
        // set() call writes a non-null value, so the invariant holds.
        return Objects.requireNonNull(snapshot.get());
    }

    public FeedHeaderInfo currentHeader() {
        return Objects.requireNonNull(headerRef.get());
    }

    /**
     * Fetches the feed and atomically replaces the cached snapshot.
     * Any error leaves the previous snapshot intact so consumers keep
     * seeing the last known state rather than an empty one.
     */
    public void refresh() {
        if (!isEnabled()) {
            return;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(feedUrl()))
                    .timeout(Duration.ofSeconds(timeoutSeconds()))
                    .header("Accept", "application/x-protobuf, application/octet-stream")
                    .GET()
                    .build();
            HttpResponse<InputStream> response =
                    http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() != 200) {
                log.warn("GTFS-RT {}: HTTP {} from {}", kindLabel(), response.statusCode(), feedUrl());
                return;
            }
            try (InputStream in = response.body()) {
                GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.parseFrom(in);
                S parsed = parseSnapshot(feed);
                snapshot.set(parsed);
                headerRef.set(RealtimeAlertCache.parseHeader(feed));
                log.debug("GTFS-RT {}: refreshed snapshot with {} entries",
                        kindLabel(), countEntries(parsed));
            }
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.warn("GTFS-RT {}: refresh interrupted: {}", kindLabel(), e.getMessage());
        } catch (IOException e) {
            log.warn("GTFS-RT {}: refresh failed: {}", kindLabel(), e.getMessage());
        }
    }
}
