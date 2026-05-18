package com.transit.hub.application.service;

import com.google.transit.realtime.GtfsRealtime;
import com.transit.hub.application.dto.response.DisplayState;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.MessageSeverity;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import lombok.RequiredArgsConstructor;
import org.jspecify.annotations.Nullable;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Cross-references the GTFS-Realtime alert snapshot with a given stop
 * and turns the matching alerts into {@link DisplayState.MessageInfo}
 * entries the kiosk can render. Extracted from
 * {@link DisplayStateCalculator} in v1.18.0 so the alert-matching
 * logic is testable without spinning up the full calculator.
 *
 * <p>The matching rules follow the GTFS-Realtime spec: an alert applies
 * when its {@code informed_entity} list either is empty (network-wide)
 * or matches the stop's GTFS id, any of its lines' GTFS ids, or any
 * of those lines' agency ids.
 */
@Service
@RequiredArgsConstructor
public class RealtimeAlertMatcher {

    private final RealtimeAlertCache realtimeAlertCache;

    public List<DisplayState.MessageInfo> buildRealtimeMessages(Stop stop, Instant now) {
        List<RealtimeAlertCache.AlertSnapshot> alerts = realtimeAlertCache.activeAlerts(now);
        if (alerts.isEmpty()) {
            return List.of();
        }
        String stopExternalId = stop.getExternalId();
        Set<String> lineExternalIds = new HashSet<>();
        Set<String> agencyExternalIds = new HashSet<>();
        for (Line l : stop.getLines()) {
            if (l.getExternalId() != null) {
                lineExternalIds.add(l.getExternalId());
            }
            if (l.getAgency() != null && l.getAgency().getExternalId() != null) {
                agencyExternalIds.add(l.getAgency().getExternalId());
            }
        }
        List<DisplayState.MessageInfo> result = new ArrayList<>();
        for (RealtimeAlertCache.AlertSnapshot a : alerts) {
            if (!matchesStop(a, stopExternalId, lineExternalIds, agencyExternalIds)) {
                continue;
            }
            String header = a.headerText();
            String description = a.descriptionText();
            // Skip alerts with no usable text — kiosks can't render
            // anything meaningful from a header-less alert.
            if ((header == null || header.isBlank())
                    && (description == null || description.isBlank())) {
                continue;
            }
            result.add(new DisplayState.MessageInfo(
                    header == null || header.isBlank() ? "Alerte" : header,
                    description == null ? "" : description,
                    severityFromAlert(a)
            ));
        }
        return result;
    }

    static boolean matchesStop(RealtimeAlertCache.AlertSnapshot a,
                               @Nullable String stopExternalId,
                               Set<String> lineExternalIds,
                               Set<String> agencyExternalIds) {
        // Empty informed_entity means "applies to the whole network";
        // treat as a network-wide alert that surfaces everywhere.
        boolean noTargets = a.routeExternalIds().isEmpty()
                && a.stopExternalIds().isEmpty()
                && a.agencyExternalIds().isEmpty();
        if (noTargets) {
            return true;
        }
        if (stopExternalId != null && a.stopExternalIds().contains(stopExternalId)) {
            return true;
        }
        for (String lineId : lineExternalIds) {
            if (a.routeExternalIds().contains(lineId)) {
                return true;
            }
        }
        for (String agencyId : agencyExternalIds) {
            if (a.agencyExternalIds().contains(agencyId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Maps GTFS-RT severity to our three-state {@link MessageSeverity}.
     * When the feed leaves severity unset, we infer from {@code effect}
     * — {@code NO_SERVICE} on a line maps to CRITICAL, partial
     * disruptions to WARNING, the rest to INFO.
     */
    static MessageSeverity severityFromAlert(RealtimeAlertCache.AlertSnapshot a) {
        GtfsRealtime.Alert.SeverityLevel level = a.severity();
        if (level == GtfsRealtime.Alert.SeverityLevel.SEVERE) {
            return MessageSeverity.CRITICAL;
        }
        if (level == GtfsRealtime.Alert.SeverityLevel.WARNING) {
            return MessageSeverity.WARNING;
        }
        if (level == GtfsRealtime.Alert.SeverityLevel.INFO) {
            return MessageSeverity.INFO;
        }
        // UNKNOWN_SEVERITY → fall back to effect inference
        GtfsRealtime.Alert.Effect effect = a.effect();
        return switch (effect) {
            case NO_SERVICE, STOP_MOVING -> MessageSeverity.CRITICAL;
            case REDUCED_SERVICE, SIGNIFICANT_DELAYS, DETOUR, ACCESSIBILITY_ISSUE,
                 MODIFIED_SERVICE -> MessageSeverity.WARNING;
            default -> MessageSeverity.INFO;
        };
    }
}
