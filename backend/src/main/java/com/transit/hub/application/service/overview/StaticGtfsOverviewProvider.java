package com.transit.hub.application.service.overview;

import com.transit.hub.application.dto.response.DataOverviewResponse;
import com.transit.hub.infrastructure.persistence.AgencyRepository;
import com.transit.hub.infrastructure.persistence.AttributionRepository;
import com.transit.hub.infrastructure.persistence.BookingRuleRepository;
import com.transit.hub.infrastructure.persistence.FareAttributeRepository;
import com.transit.hub.infrastructure.persistence.ItineraryRepository;
import com.transit.hub.infrastructure.persistence.ItineraryStopRepository;
import com.transit.hub.infrastructure.persistence.LineRepository;
import com.transit.hub.infrastructure.persistence.LocationGroupRepository;
import com.transit.hub.infrastructure.persistence.PathwayRepository;
import com.transit.hub.infrastructure.persistence.ScheduleRepository;
import com.transit.hub.infrastructure.persistence.ServiceCalendarRepository;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TransferRepository;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/**
 * Counts the persisted GTFS-Schedule + extension tables. Extracted from
 * {@code DataOverviewService} so the aggregator stays focused on
 * stitching the static and realtime slices together rather than holding
 * sixteen repository handles.
 */
@Component
@RequiredArgsConstructor
public class StaticGtfsOverviewProvider {

    private final AgencyRepository agencyRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ItineraryRepository itineraryRepository;
    private final ItineraryStopRepository itineraryStopRepository;
    private final ScheduleRepository scheduleRepository;
    private final ServiceCalendarRepository serviceCalendarRepository;
    private final TransferRepository transferRepository;
    private final PathwayRepository pathwayRepository;
    private final StationLevelRepository stationLevelRepository;
    private final FareAttributeRepository fareAttributeRepository;
    private final LocationGroupRepository locationGroupRepository;
    private final BookingRuleRepository bookingRuleRepository;
    private final TranslationRepository translationRepository;
    private final AttributionRepository attributionRepository;

    @Transactional(readOnly = true)
    public DataOverviewResponse.StaticGtfs snapshot() {
        long stops = stopRepository.count();
        long disabledStops = stopRepository.countByDisabledTrue();
        return new DataOverviewResponse.StaticGtfs(
                agencyRepository.count(),
                lineRepository.count(),
                stops,
                disabledStops,
                itineraryRepository.count(),
                itineraryStopRepository.count(),
                scheduleRepository.count(),
                serviceCalendarRepository.count(),
                transferRepository.count(),
                pathwayRepository.count(),
                stationLevelRepository.count(),
                fareAttributeRepository.count(),
                locationGroupRepository.count(),
                bookingRuleRepository.count(),
                translationRepository.count(),
                attributionRepository.count()
        );
    }
}
