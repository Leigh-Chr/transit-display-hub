package com.transit.hub.domain.util;

import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;

import java.time.ZoneId;
import java.util.Comparator;
import java.util.Set;

/**
 * Resolves the wall-clock {@link ZoneId} used to render arrival times
 * on a kiosk for a given stop. Pure domain helper — no Spring, no
 * repository, no clock — moved here so the matching unit test no
 * longer needs to bootstrap {@code DisplayStateCalculator} with seven
 * collaborators.
 *
 * <p>Four-level fallback chain (audit 2026-05-16 P2):
 * <ol>
 *   <li>{@code stop.stopTimezone()} when set</li>
 *   <li>The most-served line's agency timezone (lines sorted by
 *       {@code code} so the resolution is deterministic across
 *       feeds with equally-good candidates)</li>
 *   <li>Application default timezone (typically {@code Europe/Paris})</li>
 *   <li>Hard-coded {@code Europe/Paris} as last resort</li>
 * </ol>
 * Any malformed value is silently skipped — a single bad row in the
 * feed cannot take a kiosk offline.
 */
public final class StopZoneResolver {

    private StopZoneResolver() {
        // Static helper only — no instances.
    }

    public static ZoneId resolveZone(Stop stop, String appTimezone) {
        ZoneId fromStop = tryParseZone(stop.getStopTimezone());
        if (fromStop != null) {
            return fromStop;
        }
        Set<Line> lines = stop.getLines();
        if (lines != null && !lines.isEmpty()) {
            ZoneId fromAgency = lines.stream()
                    .filter(l -> l.getAgency() != null && l.getAgency().getTimezone() != null)
                    .sorted(Comparator
                            .comparing((Line l) -> l.getCode() == null ? "" : l.getCode()))
                    .map(l -> tryParseZone(l.getAgency().getTimezone()))
                    .filter(z -> z != null)
                    .findFirst()
                    .orElse(null);
            if (fromAgency != null) {
                return fromAgency;
            }
        }
        ZoneId fallback = tryParseZone(appTimezone);
        return fallback != null ? fallback : ZoneId.of("Europe/Paris");
    }

    public static ZoneId tryParseZone(String zone) {
        if (zone == null || zone.isBlank()) {
            return null;
        }
        try {
            return ZoneId.of(zone.trim());
        } catch (Exception e) {
            return null;
        }
    }
}
