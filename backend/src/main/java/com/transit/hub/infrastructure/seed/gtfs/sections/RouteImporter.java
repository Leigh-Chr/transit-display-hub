package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Agency;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.domain.util.ColorContrast;
import com.transit.hub.infrastructure.persistence.LineRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.extractAlphaPrefix;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.firstNonBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.mapRouteType;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseInt;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseShortOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code routes.txt} and upserts {@link Line} rows.
 * Returns a {@code Map<gtfsRouteId, Line>} for downstream importers.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RouteImporter {

    private static final int LINE_CODE_MAX_LENGTH = 30;
    private static final int LINE_NAME_MAX_LENGTH = 100;
    private static final int LINE_CATEGORY_MAX_LENGTH = 50;
    private static final String DEFAULT_COLOR = "#888888";

    private final LineRepository lineRepository;

    /**
     * Reads {@code routes.txt} and upserts {@link Line} rows, preserving
     * existing UUIDs across re-imports (see ADR 0013).
     *
     * @param routesFile      path to routes.txt inside the extracted zip
     * @param agencies        agency index built by {@link AgencyImporter}
     * @return routes indexed by GTFS route_id
     */
    public Map<String, Line> importRoutes(Path routesFile, Map<String, Agency> agencies)
            throws IOException {
        // Pre-load existing lines by external_id so re-imports keep the
        // same UUID — both Devices (via Stop → stop_lines) and
        // BroadcastMessages (scope=LINE) reference it semantically.
        // See ADR 0013.
        Map<String, Line> existingByExternalId = lineRepository.findAll().stream()
                .filter(l -> l.getExternalId() != null)
                .collect(java.util.stream.Collectors.toMap(
                        Line::getExternalId, java.util.function.Function.identity(),
                        (a, b) -> a));

        Map<String, Line> result = new LinkedHashMap<>();
        Set<UUID> seenIds = new HashSet<>();
        try (CSVParser parser = openCsv(routesFile)) {
            for (CSVRecord record : parser) {
                String routeId = record.get("route_id");
                String shortName = optional(record, "route_short_name");
                String longName = optional(record, "route_long_name");
                String color = optional(record, "route_color");
                String textColor = optional(record, "route_text_color");
                int routeType = parseInt(record.get("route_type"), 3);
                String networkId = optional(record, "network_id");
                String agencyId = optional(record, "agency_id");

                String code = truncate(firstNonBlank(shortName, longName, routeId), LINE_CODE_MAX_LENGTH);
                String name = truncate(firstNonBlank(longName, shortName, routeId), LINE_NAME_MAX_LENGTH);
                LineType type = mapRouteType(routeType);
                String category = truncate(deriveCategory(networkId, routeType), LINE_CATEGORY_MAX_LENGTH);
                String formattedColor = formatColor(color);
                String formattedTextColor = resolveTextColor(textColor, formattedColor);
                Agency agency = resolveAgency(agencyId, agencies);

                short continuousPickup = (short) parseInt(optional(record, "continuous_pickup"), 1);
                short continuousDropOff = (short) parseInt(optional(record, "continuous_drop_off"), 1);
                String sortOrderRaw = optional(record, "route_sort_order");
                Integer sortOrder = isBlank(sortOrderRaw) ? null : parseIntOrNull(sortOrderRaw);
                String routeDesc = truncate(optional(record, "route_desc"), 500);
                String routeUrl = truncate(optional(record, "route_url"), 255);

                String externalId = truncate(routeId, 100);
                Line line = existingByExternalId.containsKey(externalId)
                        ? existingByExternalId.get(externalId)
                        : new Line();
                line.setExternalId(externalId);
                line.setCode(uniqueCode(code, result.values()));
                line.setName(name);
                line.setColor(formattedColor);
                line.setTextColor(formattedTextColor);
                line.setType(type);
                line.setCategory(category);
                line.setAgency(agency);
                line.setContinuousPickup(continuousPickup);
                line.setContinuousDropOff(continuousDropOff);
                line.setSortOrder(sortOrder);
                line.setDescription(isBlank(routeDesc) ? null : routeDesc);
                line.setUrl(isBlank(routeUrl) ? null : routeUrl);
                line.setCemvSupport(parseShortOrNull(optional(record, "cemv_support")));

                Line saved = lineRepository.save(line);
                seenIds.add(saved.getId());
                result.put(routeId, saved);
            }
        }
        // Drop lines the new feed no longer declares. Cascade clears
        // schedules, itineraries, stop_lines automatically; orphan
        // BroadcastMessages with scope=LINE referencing the dropped UUID
        // simply stop matching, which is the right behaviour.
        int orphans = 0;
        for (Line old : existingByExternalId.values()) {
            if (!seenIds.contains(old.getId())) {
                lineRepository.delete(old);
                orphans++;
            }
        }
        if (orphans > 0) {
            log.info("GTFS import: {} obsolete lines removed", orphans);
        }
        // Collapse to route-type labels when network_id is absent or degenerate (single bucket)
        long distinctCategories = result.values().stream().map(Line::getCategory).distinct().count();
        if (distinctCategories <= 1) {
            for (Line line : result.values()) {
                line.setCategory(routeTypeLabel(line.getType()));
                lineRepository.save(line);
            }
        }
        splitOversizedBusCategories(result.values());
        log.info("GTFS import: {} lines created across {} categories",
                result.size(),
                result.values().stream().map(Line::getCategory).distinct().count());
        return result;
    }

    /**
     * When a single category lumps 30+ bus lines together (e.g. Bordeaux),
     * the line filter and category tab become unwieldy. Group them by the
     * alphabetic prefix of their short code: significant prefixes (≥ 3 lines)
     * become "{category} {prefix}" sub-categories; numeric-only and small
     * prefix groups keep the original category.
     */
    private void splitOversizedBusCategories(Collection<Line> lines) {
        Map<String, List<Line>> byCategory = new LinkedHashMap<>();
        for (Line line : lines) {
            byCategory.computeIfAbsent(line.getCategory(), c -> new ArrayList<>()).add(line);
        }
        for (Map.Entry<String, List<Line>> entry : byCategory.entrySet()) {
            applyPrefixSplit(entry.getKey(), entry.getValue());
        }
    }

    private void applyPrefixSplit(String category, List<Line> linesInCategory) {
        if (linesInCategory.size() < 30) { return; }
        for (Line line : linesInCategory) {
            if (line.getType() != LineType.BUS) { return; }
        }

        Map<String, List<Line>> byPrefix = new LinkedHashMap<>();
        for (Line line : linesInCategory) {
            byPrefix.computeIfAbsent(extractAlphaPrefix(line.getCode()), p -> new ArrayList<>()).add(line);
        }

        Set<String> significant = new HashSet<>();
        for (Map.Entry<String, List<Line>> entry : byPrefix.entrySet()) {
            if (!entry.getKey().isEmpty() && entry.getValue().size() >= 3) {
                significant.add(entry.getKey());
            }
        }
        if (significant.isEmpty()) { return; }

        List<Line> dirty = new ArrayList<>();
        for (Map.Entry<String, List<Line>> entry : byPrefix.entrySet()) {
            if (!significant.contains(entry.getKey())) { continue; }
            String sub = truncate(category + " " + entry.getKey(), LINE_CATEGORY_MAX_LENGTH);
            for (Line line : entry.getValue()) {
                line.setCategory(sub);
                dirty.add(line);
            }
        }
        if (!dirty.isEmpty()) {
            lineRepository.saveAll(dirty);
            log.info("GTFS import: split '{}' ({} lines) into sub-categories by prefix",
                    category, linesInCategory.size());
        }
    }

    // ---------- static helpers ----------

    private static String deriveCategory(String networkId, int routeType) {
        if (!isBlank(networkId)) {
            return networkId.trim();
        }
        return routeTypeLabel(mapRouteType(routeType));
    }

    static String routeTypeLabel(LineType type) {
        if (type == null) { return "Bus"; }
        return switch (type) {
            case TRAM -> "Tram";
            case METRO -> "Metro";
            case TRAIN -> "Train";
            case BUS -> "Bus";
            case FERRY -> "Ferry";
            case FUNICULAR -> "Funicular";
            case CABLE_CAR -> "Cable car";
            case TROLLEYBUS -> "Trolleybus";
            case MONORAIL -> "Monorail";
            case OTHER -> "Other";
        };
    }

    private static String formatColor(String raw) {
        if (isBlank(raw)) { return DEFAULT_COLOR; }
        String trimmed = raw.trim();
        String hex = trimmed.startsWith("#") ? trimmed : "#" + trimmed;
        return hex.matches("^#[0-9A-Fa-f]{6}$") ? hex : DEFAULT_COLOR;
    }

    private static String resolveTextColor(String rawTextColor, String backgroundColor) {
        if (!isBlank(rawTextColor)) {
            String trimmed = rawTextColor.trim();
            String hex = trimmed.startsWith("#") ? trimmed : "#" + trimmed;
            if (hex.matches("^#[0-9A-Fa-f]{6}$")) {
                return hex.toUpperCase(java.util.Locale.ROOT);
            }
        }
        return ColorContrast.readableTextColor(backgroundColor);
    }

    static Agency resolveAgency(String agencyId, Map<String, Agency> agencies) {
        if (agencies.isEmpty()) { return null; }
        if (!isBlank(agencyId)) {
            Agency match = agencies.get(agencyId.trim());
            if (match != null) { return match; }
        }
        if (agencies.size() == 1) {
            return agencies.values().iterator().next();
        }
        return null;
    }

    private static String uniqueCode(String preferred, Collection<Line> existing) {
        Set<String> taken = new HashSet<>();
        for (Line l : existing) { taken.add(l.getCode()); }
        if (!taken.contains(preferred)) { return preferred; }
        for (int i = 2; i < 10000; i++) {
            String candidate = truncate(preferred,
                    LINE_CODE_MAX_LENGTH - String.valueOf(i).length() - 1) + "-" + i;
            if (!taken.contains(candidate)) { return candidate; }
        }
        throw new IllegalStateException("Cannot generate unique line code for " + preferred);
    }
}
