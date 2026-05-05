package com.transit.hub.infrastructure.seed.gtfs;

import com.transit.hub.domain.model.Itinerary;
import com.transit.hub.domain.model.ItineraryStop;
import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.LineType;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Imports a standard GTFS feed into the application's domain model.
 * Network-agnostic: works with any GTFS-compliant feed.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GtfsImportService {

    private static final int LINE_CODE_MAX_LENGTH = 10;
    private static final int LINE_NAME_MAX_LENGTH = 100;
    private static final int STOP_NAME_MAX_LENGTH = 100;
    private static final String DEFAULT_COLOR = "#888888";
    private static final double SCHEMATIC_SIZE = 1000.0;
    private static final double SCHEMATIC_MARGIN = 50.0;

    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ItineraryRepository itineraryRepository;

    public record ImportResult(int lines, int stops, int itineraries, int itineraryStops) {}

    @Transactional
    public ImportResult importFromZip(Path zipPath) throws IOException {
        Path workDir = Files.createTempDirectory("gtfs-extract-");
        try {
            extractZip(zipPath, workDir);

            Map<String, Line> linesByGtfsId = importRoutes(workDir.resolve("routes.txt"));
            StopImport stopImport = importStops(workDir.resolve("stops.txt"));

            ItineraryImport itineraryImport = importItineraries(
                    workDir.resolve("trips.txt"),
                    workDir.resolve("stop_times.txt"),
                    linesByGtfsId,
                    stopImport);

            assignSchematicCoordinates(stopImport.stopsByGtfsId.values());

            return new ImportResult(
                    linesByGtfsId.size(),
                    stopImport.stopsByGtfsId.size(),
                    itineraryImport.itineraryCount,
                    itineraryImport.itineraryStopCount);
        } finally {
            deleteRecursively(workDir);
        }
    }

    private void extractZip(Path zipPath, Path target) throws IOException {
        try (ZipFile zip = new ZipFile(zipPath.toFile())) {
            zip.entries().asIterator().forEachRemaining(entry -> {
                if (entry.isDirectory()) {
                    return;
                }
                Path out = target.resolve(entry.getName()).normalize();
                if (!out.startsWith(target)) {
                    throw new IllegalStateException("Zip entry outside target: " + entry.getName());
                }
                try (InputStream in = zip.getInputStream(entry)) {
                    Files.createDirectories(out.getParent());
                    Files.copy(in, out, StandardCopyOption.REPLACE_EXISTING);
                } catch (IOException e) {
                    throw new IllegalStateException("Failed to extract " + entry.getName(), e);
                }
            });
        }
    }

    private Map<String, Line> importRoutes(Path routesFile) throws IOException {
        Map<String, Line> result = new LinkedHashMap<>();
        try (CSVParser parser = openCsv(routesFile)) {
            for (CSVRecord record : parser) {
                String routeId = record.get("route_id");
                String shortName = optional(record, "route_short_name");
                String longName = optional(record, "route_long_name");
                String color = optional(record, "route_color");
                int routeType = parseInt(record.get("route_type"), 3);

                String code = truncate(firstNonBlank(shortName, longName, routeId), LINE_CODE_MAX_LENGTH);
                String name = truncate(firstNonBlank(longName, shortName, routeId), LINE_NAME_MAX_LENGTH);
                LineType type = mapRouteType(routeType);

                Line line = lineRepository.save(Line.builder()
                        .code(uniqueCode(code, result.values()))
                        .name(name)
                        .color(formatColor(color))
                        .type(type)
                        .build());
                result.put(routeId, line);
            }
        }
        log.info("GTFS import: {} lines created", result.size());
        return result;
    }

    private record StopImport(
            Map<String, Stop> stopsByGtfsId,
            Map<String, String> rootStopIdByGtfsId) {}

    private StopImport importStops(Path stopsFile) throws IOException {
        record RawStop(String id, String name, Double lat, Double lon, String parent, int locationType) {}

        List<RawStop> raw = new ArrayList<>();
        try (CSVParser parser = openCsv(stopsFile)) {
            for (CSVRecord record : parser) {
                int locationType = parseInt(optional(record, "location_type"), 0);
                // Skip entrances/exits (2), generic nodes (3), boarding areas (4)
                if (locationType >= 2) {
                    continue;
                }
                raw.add(new RawStop(
                        record.get("stop_id"),
                        optional(record, "stop_name"),
                        parseDoubleOrNull(optional(record, "stop_lat")),
                        parseDoubleOrNull(optional(record, "stop_lon")),
                        optional(record, "parent_station"),
                        locationType));
            }
        }

        // Resolve each stop to its root (a stop with no parent_station).
        // This generic rule handles both standard and non-standard feeds:
        //   - standard: keep location_type=1 (station) when present
        //   - non-standard: keep stops without parent_station regardless of location_type
        Map<String, RawStop> byId = new HashMap<>();
        for (RawStop r : raw) {
            byId.put(r.id, r);
        }

        Map<String, String> rootByGtfsId = new HashMap<>();
        for (RawStop r : raw) {
            String current = r.id;
            int hops = 0;
            while (true) {
                RawStop currentStop = byId.get(current);
                if (currentStop == null || isBlank(currentStop.parent) || hops > 5) {
                    break;
                }
                current = currentStop.parent;
                hops++;
            }
            rootByGtfsId.put(r.id, current);
        }

        // Persist only root stops with a name and coordinates
        Map<String, Stop> result = new LinkedHashMap<>();
        Set<String> rootIds = new HashSet<>(rootByGtfsId.values());
        for (String rootId : rootIds) {
            RawStop r = byId.get(rootId);
            if (r == null || isBlank(r.name)) {
                continue;
            }
            Stop stop = Stop.builder()
                    .name(truncate(r.name, STOP_NAME_MAX_LENGTH))
                    .latitude(r.lat)
                    .longitude(r.lon)
                    .build();
            result.put(rootId, stopRepository.save(stop));
        }
        log.info("GTFS import: {} stops created (from {} raw entries)", result.size(), raw.size());
        return new StopImport(result, rootByGtfsId);
    }

    private record ItineraryImport(int itineraryCount, int itineraryStopCount) {}

    private record TripInfo(String routeId, String directionId, String headsign) {}

    private ItineraryImport importItineraries(
            Path tripsFile,
            Path stopTimesFile,
            Map<String, Line> linesByGtfsId,
            StopImport stopImport) throws IOException {

        // 1. Read trips into memory
        Map<String, TripInfo> tripInfos = new HashMap<>();
        try (CSVParser parser = openCsv(tripsFile)) {
            for (CSVRecord record : parser) {
                tripInfos.put(record.get("trip_id"), new TripInfo(
                        record.get("route_id"),
                        firstNonBlank(optional(record, "direction_id"), "0"),
                        optional(record, "trip_headsign")));
            }
        }
        log.info("GTFS import: {} trips loaded", tripInfos.size());

        // 2. Pass 1 over stop_times: count stops per trip
        Map<String, Integer> stopsPerTrip = new HashMap<>();
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                stopsPerTrip.merge(tripId, 1, Integer::sum);
            }
        }

        // 3. Select representative trip per (route_id, direction_id): the one with the most stops
        record RouteDirKey(String routeId, String directionId) {}
        Map<RouteDirKey, String> bestTrip = new HashMap<>();
        Map<RouteDirKey, Integer> bestCount = new HashMap<>();
        for (Map.Entry<String, TripInfo> entry : tripInfos.entrySet()) {
            String tripId = entry.getKey();
            TripInfo info = entry.getValue();
            if (!linesByGtfsId.containsKey(info.routeId)) {
                continue;
            }
            int count = stopsPerTrip.getOrDefault(tripId, 0);
            if (count == 0) {
                continue;
            }
            RouteDirKey key = new RouteDirKey(info.routeId, info.directionId);
            if (count > bestCount.getOrDefault(key, 0)) {
                bestCount.put(key, count);
                bestTrip.put(key, tripId);
            }
        }
        Set<String> selectedTripIds = new HashSet<>(bestTrip.values());
        log.info("GTFS import: {} representative trips selected", selectedTripIds.size());

        // 4. Pass 2 over stop_times: collect (tripId -> ordered list of stop_ids)
        record TimedStop(String stopId, int sequence) {}
        Map<String, List<TimedStop>> stopsByTrip = new HashMap<>();
        try (CSVParser parser = openCsv(stopTimesFile)) {
            for (CSVRecord record : parser) {
                String tripId = record.get("trip_id");
                if (!selectedTripIds.contains(tripId)) {
                    continue;
                }
                int sequence = parseInt(record.get("stop_sequence"), 0);
                String stopId = record.get("stop_id");
                stopsByTrip.computeIfAbsent(tripId, k -> new ArrayList<>())
                        .add(new TimedStop(stopId, sequence));
            }
        }

        // 5. Build itineraries
        int itineraryCount = 0;
        int itineraryStopCount = 0;
        Set<Stop> stopsTouched = new HashSet<>();

        for (Map.Entry<RouteDirKey, String> entry : bestTrip.entrySet()) {
            RouteDirKey key = entry.getKey();
            String tripId = entry.getValue();
            Line line = linesByGtfsId.get(key.routeId);
            TripInfo info = tripInfos.get(tripId);
            List<TimedStop> trip = stopsByTrip.get(tripId);
            if (trip == null || trip.isEmpty()) {
                continue;
            }
            trip.sort((a, b) -> Integer.compare(a.sequence, b.sequence));

            String itineraryName = buildItineraryName(line.getCode(), info.headsign, key.directionId);
            Itinerary itinerary = Itinerary.builder()
                    .line(line)
                    .name(truncate(itineraryName, LINE_NAME_MAX_LENGTH))
                    .itineraryStops(new ArrayList<>())
                    .build();
            itinerary = itineraryRepository.save(itinerary);

            int position = 0;
            Set<Stop> seenInItinerary = new HashSet<>();
            for (TimedStop ts : trip) {
                String rootStopId = stopImport.rootStopIdByGtfsId.get(ts.stopId);
                if (rootStopId == null) {
                    continue;
                }
                Stop stop = stopImport.stopsByGtfsId.get(rootStopId);
                if (stop == null) {
                    continue;
                }
                // Dedupe within itinerary (uk_itinerary_stop)
                if (!seenInItinerary.add(stop)) {
                    continue;
                }
                ItineraryStop is = ItineraryStop.builder()
                        .itinerary(itinerary)
                        .stop(stop)
                        .position(position++)
                        .build();
                itinerary.getItineraryStops().add(is);
                stop.getLines().add(line);
                stopsTouched.add(stop);
                itineraryStopCount++;
            }
            itineraryRepository.save(itinerary);
            itineraryCount++;
        }

        // Persist stop ↔ line associations
        for (Stop s : stopsTouched) {
            stopRepository.save(s);
        }

        log.info("GTFS import: {} itineraries / {} itinerary stops created", itineraryCount, itineraryStopCount);
        return new ItineraryImport(itineraryCount, itineraryStopCount);
    }

    private void assignSchematicCoordinates(Collection<Stop> stops) {
        double minLat = Double.POSITIVE_INFINITY;
        double maxLat = Double.NEGATIVE_INFINITY;
        double minLon = Double.POSITIVE_INFINITY;
        double maxLon = Double.NEGATIVE_INFINITY;
        int withGeo = 0;
        for (Stop s : stops) {
            if (s.getLatitude() == null || s.getLongitude() == null) {
                continue;
            }
            withGeo++;
            minLat = Math.min(minLat, s.getLatitude());
            maxLat = Math.max(maxLat, s.getLatitude());
            minLon = Math.min(minLon, s.getLongitude());
            maxLon = Math.max(maxLon, s.getLongitude());
        }
        log.info("GTFS import: schematic bbox over {} stops: lat=[{}, {}] lon=[{}, {}]",
                withGeo, minLat, maxLat, minLon, maxLon);
        if (Double.isInfinite(minLat) || maxLat == minLat || maxLon == minLon) {
            log.warn("GTFS import: cannot compute schematic coordinates (degenerate bbox)");
            return;
        }
        double latRange = maxLat - minLat;
        double lonRange = maxLon - minLon;
        double usable = SCHEMATIC_SIZE - 2 * SCHEMATIC_MARGIN;
        int updated = 0;
        for (Stop s : stops) {
            if (s.getLatitude() == null || s.getLongitude() == null) {
                continue;
            }
            double x = SCHEMATIC_MARGIN + ((s.getLongitude() - minLon) / lonRange) * usable;
            // Y inverted: north (high lat) is at top (low y)
            double y = SCHEMATIC_MARGIN + ((maxLat - s.getLatitude()) / latRange) * usable;
            s.setSchematicX(x);
            s.setSchematicY(y);
            stopRepository.saveAndFlush(s);
            updated++;
        }
        log.info("GTFS import: schematic coordinates assigned to {} stops", updated);
    }

    // ---------- helpers ----------

    private CSVParser openCsv(Path file) throws IOException {
        return CSVFormat.DEFAULT.builder()
                .setHeader()
                .setSkipHeaderRecord(true)
                .setIgnoreSurroundingSpaces(true)
                .setIgnoreEmptyLines(true)
                .build()
                .parse(Files.newBufferedReader(file, StandardCharsets.UTF_8));
    }

    private static LineType mapRouteType(int routeType) {
        // Standard GTFS route types + extended Hierarchical Vehicle Types (HVT, range 100-1799)
        if (routeType == 0 || routeType == 5 || routeType == 12 || (routeType >= 900 && routeType < 1000)) {
            return LineType.TRAM;
        }
        if (routeType == 1 || (routeType >= 400 && routeType < 500)) {
            return LineType.METRO;
        }
        if (routeType == 2 || (routeType >= 100 && routeType < 200)) {
            return LineType.TRAIN;
        }
        return LineType.BUS;
    }

    private static String formatColor(String raw) {
        if (isBlank(raw)) {
            return DEFAULT_COLOR;
        }
        String trimmed = raw.trim();
        String hex = trimmed.startsWith("#") ? trimmed : "#" + trimmed;
        return hex.matches("^#[0-9A-Fa-f]{6}$") ? hex : DEFAULT_COLOR;
    }

    private static String buildItineraryName(String lineCode, String headsign, String directionId) {
        if (!isBlank(headsign)) {
            return "→ " + headsign.trim();
        }
        return "Direction " + ("0".equals(directionId) ? "0" : "1");
    }

    private static String uniqueCode(String preferred, Collection<Line> existing) {
        Set<String> taken = new HashSet<>();
        for (Line l : existing) {
            taken.add(l.getCode());
        }
        if (!taken.contains(preferred)) {
            return preferred;
        }
        for (int i = 2; i < 10000; i++) {
            String candidate = truncate(preferred, LINE_CODE_MAX_LENGTH - String.valueOf(i).length() - 1)
                    + "-" + i;
            if (!taken.contains(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Cannot generate unique line code for " + preferred);
    }

    private static String optional(CSVRecord record, String column) {
        return record.isMapped(column) ? record.get(column) : "";
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (!isBlank(v)) {
                return v.trim();
            }
        }
        return "";
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() <= max ? s : s.substring(0, max);
    }

    private static int parseInt(String s, int defaultValue) {
        if (isBlank(s)) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(s.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static Double parseDoubleOrNull(String s) {
        if (isBlank(s)) {
            return null;
        }
        try {
            return Double.parseDouble(s.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static void deleteRecursively(Path path) {
        if (path == null || !Files.exists(path)) {
            return;
        }
        try (var stream = Files.walk(path)) {
            stream.sorted((a, b) -> b.getNameCount() - a.getNameCount())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                            // best-effort cleanup
                        }
                    });
        } catch (IOException ignored) {
            // best-effort cleanup
        }
    }
}
