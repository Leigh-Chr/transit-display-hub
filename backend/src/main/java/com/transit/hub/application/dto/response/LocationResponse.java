package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Location;
import org.jspecify.annotations.Nullable;

import java.util.UUID;

/**
 * Read-only DTO for the admin locations browse endpoint. Mirrors the
 * persisted shape one-for-one and surfaces the bounding box so a
 * future kiosk-popup view can pick a representative center without
 * parsing the GeoJSON.
 */
public record LocationResponse(
        UUID id,
        String externalId,
        @Nullable String stopExternalId,
        @Nullable String name,
        String geometryType,
        String geometryJson,
        @Nullable Double minLatitude,
        @Nullable Double minLongitude,
        @Nullable Double maxLatitude,
        @Nullable Double maxLongitude
) {
    public static LocationResponse from(Location l) {
        return new LocationResponse(
                l.getId(),
                l.getExternalId(),
                l.getStopExternalId(),
                l.getName(),
                l.getGeometryType(),
                l.getGeometryJson(),
                l.getMinLatitude(),
                l.getMinLongitude(),
                l.getMaxLatitude(),
                l.getMaxLongitude()
        );
    }
}
