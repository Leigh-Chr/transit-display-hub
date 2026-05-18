package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.BookingRuleResponse;
import com.transit.hub.application.dto.response.FlexStopTimeResponse;
import com.transit.hub.application.dto.response.LocationResponse;
import com.transit.hub.application.dto.response.PathwayResponse;
import com.transit.hub.application.dto.response.StationPathwayGraphResponse;
import com.transit.hub.application.dto.response.StationPathwayGraphResponse.LevelInfo;
import com.transit.hub.domain.model.BookingRule;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.model.Pathway;
import com.transit.hub.domain.model.Stop;
import com.transit.hub.domain.util.ServiceCalendarMatcher;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import com.transit.hub.infrastructure.persistence.LocationRepository;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Read-only context lookups consumed exclusively by the public stop
 * popup on the schematic map. Replaces four single-method services
 * (BookingRule / FlexAvailability / Location / Pathway) whose only
 * caller was {@code NetworkMapController} — bundling them keeps the
 * popup's data contract in one file and shrinks the controller's
 * dependency list from four collaborators to one.
 */
@Service
@RequiredArgsConstructor
public class StopPopupService {

    private final BookingRuleRepository bookingRuleRepository;
    private final FlexStopTimeRepository flexStopTimeRepository;
    private final LocationRepository locationRepository;
    private final PathwayRepository pathwayRepository;
    private final StationLevelRepository stationLevelRepository;
    private final StopRepository stopRepository;
    private final Clock clock;

    /**
     * Find the GTFS-flex zone polygon attached to a stop, by joining
     * {@code Stop.externalId} against {@code Location.stopExternalId}.
     * Returns the first match — feeds rarely publish more than one zone
     * per flexible stop, but the spec doesn't forbid it.
     */
    @Transactional(readOnly = true)
    public Optional<LocationResponse> findTadZoneByStop(UUID stopId) {
        return stopRepository.findById(stopId)
                .map(Stop::getExternalId)
                .filter(extId -> extId != null && !extId.isBlank())
                .flatMap(extId -> {
                    var matches = locationRepository.findByStopExternalId(extId);
                    return matches.isEmpty() ? Optional.empty() : Optional.of(matches.get(0));
                })
                .map(LocationResponse::from);
    }

    /**
     * Booking rules attached to schedules / flex_stop_times bound to
     * this stop. The popup renders them as booking instructions
     * (phone, URL, prior notice) for an on-demand pickup/drop-off.
     */
    @Transactional(readOnly = true)
    public List<BookingRuleResponse> findBookingRulesByStop(UUID stopId) {
        return bookingRuleRepository.findByStopId(stopId).stream()
                .sorted(Comparator
                        .comparing((BookingRule b) -> b.getBookingType().ordinal())
                        .thenComparing(BookingRule::getExternalId))
                .map(BookingRuleResponse::from)
                .toList();
    }

    /**
     * Returns the indoor pathway graph rooted at the station this stop
     * belongs to — pathways touching either the given stop OR any of
     * its sibling platforms under the same parent station, plus the
     * level rows of the station. Used by the stop-popup to surface
     * indoor connections. When the stop has no parent (free-standing),
     * the graph is the stop's own pathways.
     */
    @Transactional(readOnly = true)
    public Optional<StationPathwayGraphResponse> findPathwayGraphForStop(UUID stopId) {
        return stopRepository.findById(stopId).map(stop -> {
            Stop station = stop.getParentStop() != null ? stop.getParentStop() : stop;
            UUID stationId = station.getId();

            List<LevelInfo> levels = stationLevelRepository
                    .findByParentStopIdOrderByLevelIndex(stationId).stream()
                    .map(LevelInfo::from)
                    .toList();

            List<UUID> stopIds = new ArrayList<>(stopRepository.findChildIds(stationId));
            stopIds.add(stationId);

            List<PathwayResponse> pathways = pathwayRepository.findTouchingAny(stopIds).stream()
                    .sorted(Comparator
                            .comparing((Pathway p) -> p.getPathwayMode().ordinal())
                            .thenComparing(p -> p.getSignpostedAs() == null ? "" : p.getSignpostedAs()))
                    .map(PathwayResponse::from)
                    .toList();

            return new StationPathwayGraphResponse(
                    stationId,
                    station.getName(),
                    levels,
                    pathways
            );
        });
    }

    /**
     * Lists every GTFS-flex pickup/drop-off window available at the
     * given location on the given date. {@code externalId} is the
     * GeoJSON Feature.id shared across stops / location_groups /
     * locations.geojson. Defaults to today when {@code date} is null.
     */
    @Transactional(readOnly = true)
    public List<FlexStopTimeResponse> findFlexWindowsForLocation(String externalId, LocalDate date) {
        final LocalDate target = date != null ? date : LocalDate.now(clock);
        return flexStopTimeRepository.findByLocationExternalId(externalId).stream()
                .filter(f -> ServiceCalendarMatcher.isActive(f.getServiceCalendar(), target))
                .sorted(Comparator.comparing(FlexStopTime::getStartPickupDropOffWindow))
                .map(FlexStopTimeResponse::from)
                .toList();
    }
}
