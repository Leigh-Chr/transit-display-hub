package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Shape;
import com.transit.hub.domain.model.ShapePoint;

import java.util.List;
import java.util.UUID;

/**
 * Geographic polyline of an itinerary, sourced from GTFS
 * {@code shapes.txt}. Points are emitted in {@code shape_pt_sequence}
 * order (the entity's {@code @OrderBy} guarantees it), ready to feed
 * into Leaflet / Mapbox / any other GeoJSON consumer.
 */
public record ShapeResponse(
        UUID id,
        String externalId,
        List<Point> points
) {
    /** Single coordinate pair plus optional cumulative distance. */
    public record Point(double latitude, double longitude, Double distTraveled) {
        public static Point from(ShapePoint sp) {
            return new Point(sp.getLatitude(), sp.getLongitude(), sp.getDistTraveled());
        }
    }

    public static ShapeResponse from(Shape shape) {
        return new ShapeResponse(
                shape.getId(),
                shape.getExternalId(),
                shape.getPoints() == null ? List.of() : shape.getPoints().stream()
                        .map(Point::from)
                        .toList()
        );
    }
}
