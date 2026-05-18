package com.transit.hub.application.dto.response;

import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.model.enums.WheelchairAccess;

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
        /** GTFS location_type: 0 platform / regular stop, 1 station.
         *  Drives the "Station" / "Quai" badge in the admin list and
         *  enables the parent-aggregation behaviour on the kiosk. */
        short locationType,
        /** Parent station UUID when this row is a platform that
         *  belongs to a multi-platform station. Null on free-standing
         *  stops and on parent stations themselves. */
        UUID parentStopId,
        /** Denormalised parent name so the admin list can render
         *  "Quai 4 — Saint-Lazare" without a second request. */
        String parentStopName,
        /** GTFS {@code stops.zone_id} — opaque label that V1 fare rules
         *  reference via {@code origin_id} / {@code destination_id} /
         *  {@code contains_id}. Null on feeds without zone-based fares. */
        String zoneId,
        /** GTFS {@code stops.stop_access}: 0 = generally accessible,
         *  1 = restricted (staff-only). Null on feeds that don't ship
         *  the field. */
        Short stopAccess,
        List<LineInfo> lines,
        int scheduleCount,
        boolean hasDevice,
        /** Tombstoning flag (see {@link Stop#isDisabled()}). True means the
         *  last GTFS re-import did not find this stop in the feed. The row
         *  is hidden from kiosks but kept in the admin list so devices and
         *  broadcast messages bound to it can be re-anchored or
         *  hard-deleted explicitly. */
        boolean disabled
) {
    public static StopResponse from(Stop stop) {
        // Lazily reads stop.getSchedules() — incurs a per-row SELECT. Prefer
        // the (stop, scheduleCount) overload from listing endpoints that have
        // already aggregated the counts.
        // Stop.getSchedules() now always returns a non-null unmodifiable view.
        return from(stop, stop.getSchedules().size());
    }

    public static StopResponse from(Stop stop, int scheduleCount) {
        List<LineInfo> lineInfos = LineInfo.fromSorted(stop.getLines());

        Stop parent = stop.getParentStop();
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
                stop.getLocationType(),
                parent != null ? parent.getId() : null,
                parent != null ? parent.getName() : null,
                stop.getZoneId(),
                stop.getStopAccess(),
                lineInfos,
                scheduleCount,
                stop.getDevices() != null && !stop.getDevices().isEmpty(),
                stop.isDisabled()
        );
    }
}
