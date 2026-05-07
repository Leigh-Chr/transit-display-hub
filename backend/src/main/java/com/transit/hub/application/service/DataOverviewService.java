package com.transit.hub.application.service;

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
import com.transit.hub.infrastructure.persistence.ShapeRepository;
import com.transit.hub.infrastructure.persistence.StationLevelRepository;
import com.transit.hub.infrastructure.persistence.StopRepository;
import com.transit.hub.infrastructure.persistence.TransferRepository;
import com.transit.hub.infrastructure.persistence.TranslationRepository;
import com.transit.hub.infrastructure.realtime.RealtimeAlertCache;
import com.transit.hub.infrastructure.realtime.RealtimeTripUpdateCache;
import com.transit.hub.infrastructure.realtime.RealtimeVehiclePositionCache;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
@RequiredArgsConstructor
public class DataOverviewService {

    private final AgencyRepository agencyRepository;
    private final LineRepository lineRepository;
    private final StopRepository stopRepository;
    private final ItineraryRepository itineraryRepository;
    private final ItineraryStopRepository itineraryStopRepository;
    private final ScheduleRepository scheduleRepository;
    private final ServiceCalendarRepository serviceCalendarRepository;
    private final TransferRepository transferRepository;
    private final ShapeRepository shapeRepository;
    private final PathwayRepository pathwayRepository;
    private final StationLevelRepository stationLevelRepository;
    private final FareAttributeRepository fareAttributeRepository;
    private final LocationGroupRepository locationGroupRepository;
    private final BookingRuleRepository bookingRuleRepository;
    private final TranslationRepository translationRepository;
    private final AttributionRepository attributionRepository;

    private final RealtimeAlertCache alertCache;
    private final RealtimeTripUpdateCache tripUpdateCache;
    private final RealtimeVehiclePositionCache vehiclePositionCache;

    @Transactional(readOnly = true)
    public DataOverviewResponse current() {
        long stops = stopRepository.count();
        long disabledStops = stopRepository.countByDisabledTrue();
        DataOverviewResponse.StaticGtfs staticPart = new DataOverviewResponse.StaticGtfs(
                agencyRepository.count(),
                lineRepository.count(),
                stops,
                disabledStops,
                itineraryRepository.count(),
                itineraryStopRepository.count(),
                scheduleRepository.count(),
                serviceCalendarRepository.count(),
                transferRepository.count(),
                shapeRepository.count(),
                pathwayRepository.count(),
                stationLevelRepository.count(),
                fareAttributeRepository.count(),
                locationGroupRepository.count(),
                bookingRuleRepository.count(),
                translationRepository.count(),
                attributionRepository.count()
        );
        DataOverviewResponse.Realtime realtimePart = new DataOverviewResponse.Realtime(
                alertCache.activeAlerts(Instant.now()).size(),
                tripUpdateCache.snapshotSize(),
                vehiclePositionCache.currentSnapshot().size(),
                alertCache.isEnabled(),
                tripUpdateCache.isEnabled(),
                vehiclePositionCache.isEnabled()
        );
        return new DataOverviewResponse(staticPart, realtimePart);
    }
}
