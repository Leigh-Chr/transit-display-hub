package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Shape;
import com.transit.hub.domain.model.ShapePoint;
import com.transit.hub.infrastructure.persistence.ShapeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVRecord;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.isBlank;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.openCsv;
import static com.transit.hub.infrastructure.seed.gtfs.sections.CsvHelper.optional;

/**
 * Reads {@code shapes.txt} and replaces the {@link Shape} + {@link ShapePoint}
 * tables on every import. Each {@code shape_id} maps to a {@link Shape} entity
 * carrying its ordered list of {@link ShapePoint} rows.
 *
 * <p>Returns a {@code Map<gtfsShapeId, Shape>} so the itinerary importer
 * can wire each itinerary's representative-trip shape FK.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class ShapeImporter {

    private final ShapeRepository shapeRepository;

    /**
     * Wipes shapes and shape_points tables then re-imports from
     * {@code shapes.txt}. Absent file is silently skipped (itineraries
     * will have no geographic polyline).
     *
     * @return shapes indexed by GTFS shape_id
     */
    public Map<String, Shape> importShapes(Path shapesFile) throws IOException {
        // Cascade clears shape_points. Order matters: itineraries.shape_id
        // is ON DELETE SET NULL so existing itineraries' FKs go null
        // here, then importItineraries sets them again immediately after.
        shapeRepository.deleteAllInBatch();
        shapeRepository.flush();

        Map<String, Shape> result = new HashMap<>();
        if (!Files.exists(shapesFile)) {
            log.info("GTFS import: shapes.txt missing, itineraries will have no geographic polyline");
            return result;
        }
        Map<String, List<ShapePoint>> pointsByShape = new HashMap<>();
        try (CSVParser parser = openCsv(shapesFile)) {
            for (CSVRecord record : parser) {
                String shapeId = optional(record, "shape_id");
                if (isBlank(shapeId)) { continue; }
                Double lat = parseDoubleOrNull(optional(record, "shape_pt_lat"));
                Double lon = parseDoubleOrNull(optional(record, "shape_pt_lon"));
                Integer sequence = parseIntOrNull(optional(record, "shape_pt_sequence"));
                if (lat == null || lon == null || sequence == null) { continue; }
                ShapePoint point = ShapePoint.builder()
                        .sequence(sequence)
                        .latitude(lat)
                        .longitude(lon)
                        .distTraveled(parseDoubleOrNull(optional(record, "shape_dist_traveled")))
                        .build();
                pointsByShape.computeIfAbsent(shapeId, k -> new ArrayList<>()).add(point);
            }
        }
        int totalPoints = 0;
        for (Map.Entry<String, List<ShapePoint>> entry : pointsByShape.entrySet()) {
            String shapeId = entry.getKey();
            List<ShapePoint> points = entry.getValue();
            // GTFS doesn't guarantee shape_pt_sequence rows arrive in
            // order — sort defensively before we hand them to the
            // unique constraint and to OrderBy("sequence ASC").
            points.sort((a, b) -> Integer.compare(a.getSequence(), b.getSequence()));
            // Deduplicate consecutive (sequence) values: rare feeds
            // occasionally repeat a row, which would violate the UK.
            // Keep the first occurrence only.
            Set<Integer> seenSeq = new HashSet<>();
            points.removeIf(p -> !seenSeq.add(p.getSequence()));

            Shape shape = Shape.builder()
                    .externalId(truncate(shapeId, 100))
                    .build();
            for (ShapePoint p : points) {
                p.setShape(shape);
                shape.getPoints().add(p);
            }
            Shape saved = shapeRepository.save(shape);
            result.put(shapeId, saved);
            totalPoints += points.size();
        }
        log.info("GTFS import: {} shapes / {} shape points persisted", result.size(), totalPoints);
        return result;
    }
}
