package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Line;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.WheelchairAccess;

import java.util.Comparator;
import java.util.List;
import java.util.UUID;

public record StopResponse(
        UUID id,
        String name,
        Double latitude,
        Double longitude,
        /** GTFS stop_code — short identifier on the physical signpost. */
        String shortCode,
        /** GTFS platform_code — quay / track designation. */
        String platformCode,
        /** GTFS stop_desc — free-form description. */
        String description,
        /** GTFS stop_url — public link describing the stop. */
        String url,
        /** GTFS wheelchair_boarding tri-state. Null when the feed didn't
         *  publish the field — admins see the difference between
         *  "explicitly unknown" (UNKNOWN) and "absent". */
        WheelchairAccess wheelchairBoarding,
        List<LineInfo> lines,
        int scheduleCount,
        boolean hasDevice
) {
    public static StopResponse from(Stop stop) {
        // Lazily reads stop.getSchedules() — incurs a per-row SELECT. Prefer
        // the (stop, scheduleCount) overload from listing endpoints that have
        // already aggregated the counts.
        return from(stop, stop.getSchedules() != null ? stop.getSchedules().size() : 0);
    }

    public static StopResponse from(Stop stop, int scheduleCount) {
        List<LineInfo> lineInfos = stop.getLines().stream()
                .sorted(Comparator.comparing(Line::getCode))
                .map(LineInfo::from)
                .toList();

        return new StopResponse(
                stop.getId(),
                stop.getName(),
                stop.getLatitude(),
                stop.getLongitude(),
                stop.getShortCode(),
                stop.getPlatformCode(),
                stop.getDescription(),
                stop.getUrl(),
                stop.getWheelchairBoarding(),
                lineInfos,
                scheduleCount,
                stop.getDevices() != null && !stop.getDevices().isEmpty()
        );
    }
}
