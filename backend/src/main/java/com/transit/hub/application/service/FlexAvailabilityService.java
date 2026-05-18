package com.transit.hub.application.service;

import com.transit.hub.application.dto.response.FlexStopTimeResponse;
import com.transit.hub.domain.model.FlexStopTime;
import com.transit.hub.domain.util.ServiceCalendarMatcher;
import com.transit.hub.infrastructure.persistence.FlexStopTimeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

/**
 * Resolves which GTFS-flex windows are available right now (or at a
 * given target date) for a TAD location. Combines
 * {@link com.transit.hub.domain.model.FlexStopTime} rows with the
 * row's {@link ServiceCalendar} so the kiosk / popup can render
 * "réservation possible aujourd'hui de 11h à 13h".
 */
@Service
@RequiredArgsConstructor
public class FlexAvailabilityService {

    private final FlexStopTimeRepository flexStopTimeRepository;
    private final Clock clock;

    /** Lists every flex window available at the given location today,
     *  filtering by service calendar weekday. The {@code locationId}
     *  is the GTFS external id (geojson Feature.id). */
    @Transactional(readOnly = true)
    public List<FlexStopTimeResponse> findWindowsForLocation(String externalId, LocalDate date) {
        final LocalDate target = date != null ? date : LocalDate.now(clock);
        return flexStopTimeRepository.findByLocationExternalId(externalId).stream()
                .filter(f -> ServiceCalendarMatcher.isActive(f.getServiceCalendar(), target))
                .sorted(Comparator.comparing(FlexStopTime::getStartPickupDropOffWindow))
                .map(FlexStopTimeResponse::from)
                .toList();
    }

}
