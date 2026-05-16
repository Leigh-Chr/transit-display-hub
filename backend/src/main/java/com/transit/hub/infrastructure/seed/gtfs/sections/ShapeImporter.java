package com.transit.hub.infrastructure.seed.gtfs.sections;

import com.transit.hub.domain.model.Shape;
import com.transit.hub.domain.model.ShapePoint;
import com.transit.hub.infrastructure.persistence.ShapeRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseDoubleOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.parseIntOrNull;
import static com.transit.hub.infrastructure.seed.gtfs.GtfsParse.truncate;
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
        Map<String, Shape> result = new HashMap<>();
        GtfsSectionImporter.runAggregating(
                shapeRepository,
                shapesFile,
                "shapes",
                record -> optional(record, "shape_id"),
                ShapeImporter::mapPointRow,
                (shapeId, points) -> {
                    Shape shape = buildShape(shapeId, points);
                    // Repository.saveAll() happens inside the helper, but
                    // callers need the persisted Shape map indexed by its
                    // external_id to wire downstream itineraries' FK. The
                    // entity itself is the same JPA instance the helper
                    // will save, so populating the map here is safe and
                    // avoids a second round-trip to fetch by externalId.
                    result.put(shapeId, shape);
                    return shape;
                },
                log
        );
        return result;
    }

    private static Optional<ShapePoint> mapPointRow(org.apache.commons.csv.CSVRecord record) {
        Double lat = parseDoubleOrNull(optional(record, "shape_pt_lat"));
        Double lon = parseDoubleOrNull(optional(record, "shape_pt_lon"));
        Integer sequence = parseIntOrNull(optional(record, "shape_pt_sequence"));
        if (lat == null || lon == null || sequence == null) {
            return Optional.empty();
        }
        return Optional.of(ShapePoint.builder()
                .sequence(sequence)
                .latitude(lat)
                .longitude(lon)
                .distTraveled(parseDoubleOrNull(optional(record, "shape_dist_traveled")))
                .build());
    }

    private static Shape buildShape(String shapeId, List<ShapePoint> points) {
        // GTFS doesn't guarantee shape_pt_sequence rows arrive in order —
        // sort defensively before we hand them to the unique constraint
        // and to @OrderBy("sequence ASC").
        points.sort((a, b) -> Integer.compare(a.getSequence(), b.getSequence()));
        // Deduplicate consecutive (sequence) values: rare feeds occasionally
        // repeat a row, which would violate the UK. Keep the first
        // occurrence only.
        Set<Integer> seenSeq = new HashSet<>();
        points.removeIf(p -> !seenSeq.add(p.getSequence()));

        Shape shape = Shape.builder()
                .externalId(truncate(shapeId, 100))
                .build();
        for (ShapePoint p : points) {
            p.setShape(shape);
            shape.getPoints().add(p);
        }
        return shape;
    }
}
