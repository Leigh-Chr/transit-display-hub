package com.transit.hub.infrastructure.realtime;

import com.google.transit.realtime.GtfsRealtime;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * In-memory cache of GTFS-Realtime {@code ServiceAlert}s. A single
 * background poll fetches the configured feed URL, parses the
 * Protobuf {@code FeedMessage}, and replaces the snapshot atomically
 * so {@link com.transit.hub.domain.service.DisplayStateCalculator}
 * reads through a single volatile reference without locking.
 * <p>
 * Disabled when {@code app.gtfs-rt.alerts-url} is empty: the cache
 * holds an empty snapshot and refresh is a no-op. That keeps installs
 * without a realtime feed unaffected.
 */
@Component
@Slf4j
public class RealtimeAlertCache {

    /**
     * Public-facing snapshot of an active service alert, distilled
     * from the Protobuf payload into the fields the kiosk and the
     * admin endpoint actually need.
     */
    public record AlertSnapshot(
            String id,
            Set<String> routeExternalIds,
            Set<String> stopExternalIds,
            Set<String> agencyExternalIds,
            String headerText,
            String descriptionText,
            String url,
            GtfsRealtime.Alert.Cause cause,
            GtfsRealtime.Alert.Effect effect,
            GtfsRealtime.Alert.SeverityLevel severity,
            List<GtfsRealtime.TimeRange> activePeriods
    ) {
        /** Returns true when the alert has no active period or at least
         *  one period contains the given instant. GTFS-RT treats an
         *  empty active_period list as "always active for the duration
         *  of the feed". */
        public boolean isActiveAt(Instant now) {
            if (activePeriods == null || activePeriods.isEmpty()) {
                return true;
            }
            long epoch = now.getEpochSecond();
            for (GtfsRealtime.TimeRange period : activePeriods) {
                long start = period.hasStart() ? period.getStart() : Long.MIN_VALUE;
                long end = period.hasEnd() ? period.getEnd() : Long.MAX_VALUE;
                if (epoch >= start && epoch <= end) {
                    return true;
                }
            }
            return false;
        }
    }

    private final AtomicReference<List<AlertSnapshot>> snapshot =
            new AtomicReference<>(List.of());

    @Value("${app.gtfs-rt.alerts-url:}")
    private String alertsUrl = "";

    @Value("${app.gtfs-rt.timeout-seconds:10}")
    private int timeoutSeconds = 10;

    private final HttpClient http = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(10))
            .build();

    /** Returns every alert currently in the cache that is active at
     *  {@code now}. The kiosk filters further by route / stop. */
    public List<AlertSnapshot> activeAlerts(Instant now) {
        List<AlertSnapshot> all = snapshot.get();
        if (all.isEmpty()) {
            return List.of();
        }
        List<AlertSnapshot> active = new ArrayList<>(all.size());
        for (AlertSnapshot a : all) {
            if (a.isActiveAt(now)) {
                active.add(a);
            }
        }
        return active;
    }

    /** Returns true when the cache is configured to receive a feed. */
    public boolean isEnabled() {
        return alertsUrl != null && !alertsUrl.isBlank();
    }

    /**
     * Fetches the alerts feed and replaces the cached snapshot.
     * Logs a warning on any error and leaves the previous snapshot
     * in place — the kiosk continues to render the last known state
     * rather than silently dropping all alerts on a single hiccup.
     */
    public void refresh() {
        if (!isEnabled()) {
            return;
        }
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(alertsUrl))
                    .timeout(Duration.ofSeconds(timeoutSeconds))
                    .header("Accept", "application/x-protobuf, application/octet-stream")
                    .GET()
                    .build();
            HttpResponse<InputStream> response = http.send(request, HttpResponse.BodyHandlers.ofInputStream());
            if (response.statusCode() != 200) {
                log.warn("GTFS-RT alerts: HTTP {} from {}", response.statusCode(), alertsUrl);
                return;
            }
            try (InputStream in = response.body()) {
                GtfsRealtime.FeedMessage feed = GtfsRealtime.FeedMessage.parseFrom(in);
                List<AlertSnapshot> alerts = parseAlerts(feed);
                snapshot.set(alerts);
                log.info("GTFS-RT alerts: refreshed snapshot with {} alerts", alerts.size());
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("GTFS-RT alerts: refresh failed: {}", e.getMessage());
        }
    }

    private static List<AlertSnapshot> parseAlerts(GtfsRealtime.FeedMessage feed) {
        List<AlertSnapshot> result = new ArrayList<>(feed.getEntityCount());
        for (GtfsRealtime.FeedEntity entity : feed.getEntityList()) {
            if (entity.getIsDeleted() || !entity.hasAlert()) {
                continue;
            }
            GtfsRealtime.Alert alert = entity.getAlert();
            Set<String> routes = new HashSet<>();
            Set<String> stops = new HashSet<>();
            Set<String> agencies = new HashSet<>();
            for (GtfsRealtime.EntitySelector selector : alert.getInformedEntityList()) {
                if (selector.hasRouteId() && !selector.getRouteId().isEmpty()) {
                    routes.add(selector.getRouteId());
                }
                if (selector.hasStopId() && !selector.getStopId().isEmpty()) {
                    stops.add(selector.getStopId());
                }
                if (selector.hasAgencyId() && !selector.getAgencyId().isEmpty()) {
                    agencies.add(selector.getAgencyId());
                }
            }
            result.add(new AlertSnapshot(
                    entity.getId(),
                    Collections.unmodifiableSet(routes),
                    Collections.unmodifiableSet(stops),
                    Collections.unmodifiableSet(agencies),
                    pickFirst(alert.getHeaderText()),
                    pickFirst(alert.getDescriptionText()),
                    pickFirst(alert.getUrl()),
                    alert.getCause(),
                    alert.getEffect(),
                    alert.getSeverityLevel(),
                    new ArrayList<>(alert.getActivePeriodList())
            ));
        }
        return Collections.unmodifiableList(result);
    }

    /**
     * Returns the first translation's text — GTFS-RT carries arrays
     * of translated strings; for the kiosk's single-language
     * rendering we keep the first entry, which by convention is the
     * default language.
     */
    private static String pickFirst(GtfsRealtime.TranslatedString translated) {
        if (translated == null || translated.getTranslationCount() == 0) {
            return null;
        }
        return translated.getTranslation(0).getText();
    }
}
